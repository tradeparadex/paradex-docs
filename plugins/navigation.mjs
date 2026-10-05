// Builds the site structure from docs/navigation.yml.
//
// navigation.yml keeps the schema the site used under Fern, and this module
// reproduces Fern's URL rules so every existing link keeps working:
//   - a tab contributes its `slug` as the first URL segment;
//   - a section contributes `slug`, or its title in kebab case when `slug`
//     is absent; `slug: ""` or `skip-slug: true` contributes nothing;
//   - a page's URL is its parent sections' segments plus its own slug (or
//     kebab-cased title);
//   - a section with `path` gets a landing page at the section URL.
//
// The result drives the Docusaurus sidebars (one per tab), the URL of every
// page (injected as `slug` front matter), the header tabs and the redirects
// for tab/section URLs that have no page of their own.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import kebabCase from 'lodash/kebabCase.js';

export const slugify = (value) => kebabCase(String(value));

const joinUrl = (segments) => '/' + segments.filter(Boolean).join('/');

export function readFrontMatter(absPath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(absPath, 'utf8'));
  return (match && yaml.load(match[1])) || {};
}

/**
 * @param {object} options
 * @param {string} options.siteDir      Repository root.
 * @param {string} options.contentDir   Directory holding navigation.yml.
 * @param {string} options.pagesDir     Docs plugin content directory.
 * @param {(item: object, ctx: {urlSegments: string[], tabKey: string}) => {items: object[], firstUrl?: string}} [options.resolveApi]
 *   Returns the sidebar items for an `api` entry.
 */
export function loadNavigation({siteDir, contentDir, pagesDir, resolveApi}) {
  const file = path.join(contentDir, 'navigation.yml');
  const config = yaml.load(fs.readFileSync(file, 'utf8'));

  /** Absolute file path -> page info. */
  const pages = new Map();
  /** Sidebar id -> sidebar items. */
  const sidebars = {};
  const tabs = [];
  /** URLs without a page of their own -> first page below them. */
  const implicitRedirects = new Map();
  const changelogs = [];

  const toDocId = (absPath) =>
    path.relative(pagesDir, absPath).replace(/\\/g, '/').replace(/\.mdx?$/, '');

  function addPage(item, label, urlSegments, tabKey, extra = {}) {
    const absPath = path.resolve(contentDir, item.path);
    if (!fs.existsSync(absPath)) {
      throw new Error(`navigation.yml: ${item.path} does not exist`);
    }
    if (pages.has(absPath)) {
      throw new Error(`navigation.yml: ${item.path} is listed more than once`);
    }
    const frontMatter = readFrontMatter(absPath);
    // A `slug` in front matter is the page's full path, as in Fern.
    const url = frontMatter.slug
      ? joinUrl([String(frontMatter.slug).replace(/^\/+/, '')])
      : joinUrl(urlSegments);
    pages.set(absPath, {
      frontMatter,
      // Fern's `layout: custom` pages render full width without a sidebar.
      noSidebar: frontMatter.layout === 'custom',
      url,
      label,
      tabKey,
      docId: toDocId(absPath),
      icon: item.icon,
      ...extra,
    });
    return {url, docId: toDocId(absPath)};
  }

  function walk(items, urlSegments, tabKey, depth) {
    const sidebarItems = [];
    let firstUrl;
    const noteFirst = (url) => {
      if (!firstUrl && url) firstUrl = url;
    };

    for (const item of items ?? []) {
      if (item.page !== undefined) {
        const slug = item.slug ?? slugify(item.page);
        const {url, docId} = addPage(item, item.page, [...urlSegments, slug], tabKey);
        noteFirst(url);
        if (item.hidden || pages.get(path.resolve(contentDir, item.path)).noSidebar) continue;
        sidebarItems.push({
          type: 'doc',
          id: docId,
          label: item.page,
          ...(item.icon ? {customProps: {icon: item.icon}} : {}),
        });
      } else if (item.section !== undefined) {
        const skip = item['skip-slug'] === true || item.slug === '';
        const slug = skip ? null : (item.slug ?? slugify(item.section));
        const segments = slug ? [...urlSegments, slug] : urlSegments;
        let link;
        if (item.path) {
          const {url, docId} = addPage(item, item.section, segments, tabKey, {
            isSectionLanding: true,
          });
          noteFirst(url);
          link = {type: 'doc', id: docId};
        }
        const child = walk(item.contents, segments, tabKey, depth + 1);
        noteFirst(child.firstUrl);
        const sectionUrl = joinUrl(segments);
        if (!item.path && child.firstUrl && slug) {
          implicitRedirects.set(sectionUrl, child.firstUrl);
        }
        if (item.hidden) continue;
        sidebarItems.push({
          type: 'category',
          label: item.section,
          items: child.items,
          ...(link ? {link} : {}),
          // Top-level sections render as headings, like Fern's sidebar; one
          // with its own page is a semibold page row instead, so it can show
          // as the current page.
          collapsible: depth > 0,
          collapsed: depth > 0 ? item.collapsed !== false : false,
          className: depth === 0 ? (link ? 'sidebar-section-page' : 'sidebar-section-heading') : undefined,
          ...(item.icon ? {customProps: {icon: item.icon}} : {}),
        });
      } else if (item.link !== undefined) {
        sidebarItems.push({
          type: 'link',
          label: item.link,
          href: item.href,
          ...(item.icon ? {customProps: {icon: item.icon}} : {}),
        });
      } else if (item.api !== undefined) {
        if (!resolveApi) continue;
        const skip = item['skip-slug'] === true;
        const segments = skip ? urlSegments : [...urlSegments, slugify(item.api)];
        const result = resolveApi(item, {urlSegments: segments, tabKey});
        noteFirst(result.firstUrl);
        for (const [from, to] of result.redirects ?? []) implicitRedirects.set(from, to);
        sidebarItems.push(...result.items);
      } else if (item.changelog !== undefined) {
        const url = joinUrl([...urlSegments, 'changelog']);
        changelogs.push({
          tabKey,
          url,
          dir: path.resolve(contentDir, item.changelog),
        });
        noteFirst(url);
      } else {
        throw new Error(`navigation.yml: unknown item ${JSON.stringify(item)}`);
      }
    }
    return {items: sidebarItems, firstUrl};
  }

  for (const nav of config.navigation) {
    const tabConfig = config.tabs[nav.tab];
    if (!tabConfig) throw new Error(`navigation.yml: unknown tab ${nav.tab}`);
    const tabSlug = tabConfig.slug ?? slugify(tabConfig['display-name']);
    const {items, firstUrl} = walk(nav.layout, [tabSlug], nav.tab, 0);
    const sidebarId = `tab-${nav.tab}`;
    sidebars[sidebarId] = items;
    tabs.push({
      key: nav.tab,
      label: tabConfig['display-name'],
      slug: tabSlug,
      sidebarId,
      href: firstUrl,
    });
    if (firstUrl && firstUrl !== `/${tabSlug}`) {
      implicitRedirects.set(`/${tabSlug}`, firstUrl);
    }
  }

  // Fern hides the sidebar of a tab that holds a single page (Home, DIME).
  for (const tab of tabs) {
    const items = sidebars[tab.sidebarId];
    if (items.length === 1 && items[0].type === 'doc') {
      const page = [...pages.values()].find((p) => p.docId === items[0].id);
      if (page) page.noSidebar = true;
      delete sidebars[tab.sidebarId];
    }
  }

  return {
    config,
    pages,
    sidebars,
    tabs,
    changelogs,
    implicitRedirects,
    navbarLinks: config['navbar-links'] ?? [],
    pageForFile: (absPath) => pages.get(path.resolve(absPath)),
    siteDir,
  };
}
