// The navigation as Fern's node tree, for the llms.txt indexes and the
// search index: root > tab > section > page, apiReference > apiPackage >
// endpoint/webSocket, changelog > changelogEntry. URLs come from the site
// model (plugins/site.mjs), so they match the pages exactly.
//
// Fern's rules reproduced here (fern-docs bundle, NodeCollector and the
// llms.txt route):
//   - slugMap: the first node with a URL wins, except that a later visible
//     page replaces an earlier node that is hidden or not a page (so /home
//     maps to the Home page, not the Home tab);
//   - <url>/llms.txt for a page resolves to the top-most ancestor with the
//     same URL, if any (the Home tab for /home);
//   - an endpoint listed in two API sections (prod, testnet) has one
//     canonical URL, the first one in navigation order.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import {slugify} from './navigation.mjs';
import {changelogEntryUrl, parseChangelogFileName} from './site.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const joinUrl = (segments) => '/' + segments.filter(Boolean).join('/');

/** Fern's isPage: pages, section overviews, API leaves, changelogs and entries. */
export const isPage = (node) =>
  node.type === 'page' || node.type === 'changelogEntry' || node.type === 'changelog' || node.type === 'endpoint' || node.type === 'webSocket' || (node.type === 'section' && node.page != null);
/** Fern's hasMarkdown: nodes with a Markdown page of their own. */
export const hasMarkdown = (node) =>
  node.type === 'page' || node.type === 'changelogEntry' || (node.type === 'section' && node.page != null) || (node.type === 'changelog' && node.overviewFile != null);
export const isApiLeaf = (node) => node.type === 'endpoint' || node.type === 'webSocket';

export function buildNavTree(site) {
  const config = yaml.load(fs.readFileSync(path.join(site.contentDir, 'navigation.yml'), 'utf8'));
  const root = {type: 'root', title: 'Paradex | Documentation', url: '/', children: []};

  const attach = (parent, node) => {
    node.parent = parent;
    node.children ??= [];
    parent.children.push(node);
    return node;
  };

  function walk(parent, items, segments) {
    for (const item of items ?? []) {
      if (item.page !== undefined) {
        const file = path.resolve(site.contentDir, item.path);
        const page = site.pages.get(file);
        if (!page) continue;
        attach(parent, {type: 'page', title: item.page, url: page.url, file, page, hidden: Boolean(item.hidden)});
      } else if (item.section !== undefined) {
        const skip = item['skip-slug'] === true || item.slug === '';
        const slug = skip ? null : (item.slug ?? slugify(item.section));
        const sectionSegments = slug ? [...segments, slug] : segments;
        const file = item.path ? path.resolve(site.contentDir, item.path) : undefined;
        const page = file ? site.pages.get(file) : undefined;
        const node = attach(parent, {
          type: 'section',
          title: item.section,
          url: page?.url ?? joinUrl(sectionSegments),
          file: page ? file : undefined,
          page,
          hidden: Boolean(item.hidden),
        });
        walk(node, item.contents, sectionSegments);
      } else if (item.api !== undefined) {
        const skip = item['skip-slug'] === true;
        const apiSegments = skip ? segments : [...segments, slugify(item.api)];
        const prefix = joinUrl(apiSegments);
        const spec = site.api.specs.get(item['api-name']);
        const reference = attach(parent, {type: 'apiReference', title: item.api, url: prefix, apiName: item['api-name'], apiType: spec?.type, hidden: Boolean(item.hidden)});
        const groups = new Map();
        for (const page of site.api.pages) {
          if (page.api !== item['api-name'] || !page.url.startsWith(prefix + '/')) continue;
          const groupUrl = page.url.slice(0, page.url.lastIndexOf('/'));
          if (!groups.has(groupUrl)) groups.set(groupUrl, attach(reference, {type: 'apiPackage', title: page.group, url: groupUrl}));
          attach(groups.get(groupUrl), {
            type: page.data.kind === 'websocket' ? 'webSocket' : 'endpoint',
            title: page.title,
            url: page.url,
            file: page.file,
            page,
          });
        }
      } else if (item.changelog !== undefined) {
        const url = joinUrl([...segments, 'changelog']);
        const dir = path.resolve(site.contentDir, item.changelog);
        const overviewFile = path.join(dir, 'overview.mdx');
        const node = attach(parent, {
          type: 'changelog',
          title: 'Changelog',
          url,
          dir,
          overviewFile: fs.existsSync(overviewFile) ? overviewFile : undefined,
          hidden: Boolean(item.hidden),
        });
        const entries = fs
          .readdirSync(dir)
          .map((name) => ({name, date: parseChangelogFileName(name)}))
          .filter((e) => e.date)
          .sort((a, b) => new Date(b.date.year, b.date.month - 1, b.date.day) - new Date(a.date.year, a.date.month - 1, a.date.day));
        for (const {name, date} of entries) {
          attach(node, {
            type: 'changelogEntry',
            title: `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`,
            url: changelogEntryUrl(url, date),
            file: path.join(dir, name),
            date,
          });
        }
      }
      // `link` items have no page.
    }
  }

  for (const nav of config.navigation) {
    const tabConfig = config.tabs[nav.tab];
    const tabSlug = tabConfig.slug ?? slugify(tabConfig['display-name']);
    const tab = attach(root, {type: 'tab', title: tabConfig['display-name'], url: `/${tabSlug}`, hidden: Boolean(tabConfig.hidden)});
    walk(tab, nav.layout, [tabSlug]);
  }

  // Depth-first order, ancestors, canonical URLs and the slug map.
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);

  const canonical = new Map();
  for (const node of nodes) {
    if (!isApiLeaf(node)) continue;
    const key = `${node.type} ${node.page.relativeUrl}`;
    if (!canonical.has(key)) canonical.set(key, node.url);
    node.canonicalUrl = canonical.get(key);
  }

  const slugMap = new Map();
  for (const node of nodes) {
    if (node.type === 'root') continue;
    const existing = slugMap.get(node.url);
    if (existing == null) slugMap.set(node.url, node);
    else if (!node.hidden && isPage(node) && (existing.hidden || !isPage(existing))) slugMap.set(node.url, node);
  }

  return {root, nodes, slugMap};
}

/** Ancestors from the root down (excluding the node itself). */
export function ancestorsOf(node) {
  const out = [];
  for (let current = node.parent; current != null; current = current.parent) out.unshift(current);
  return out;
}

/** The node Fern served for <url>/llms.txt (undefined: not found). */
export function llmsTxtNodeFor(tree, url) {
  const node = tree.slugMap.get(url);
  if (node == null || !isPage(node)) return node;
  for (const ancestor of ancestorsOf(node)) {
    if (ancestor.type !== 'root' && ancestor.url === node.url) return ancestor;
  }
  return node;
}
