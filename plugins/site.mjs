// Build-time model of the whole site, computed once when the Docusaurus
// config loads:
//   - generates the REST and WebSocket reference pages from the specs in
//     docs/apis (into docs/pages/generated, which is gitignored);
//   - reads docs/navigation.yml to get every page URL and the sidebars;
//   - prepares the changelog (release notes) and the redirects.

import fs from 'node:fs';
import path from 'node:path';

import {loadNavigation} from './navigation.mjs';
import {loadRedirectRules, expandRedirects} from './redirects.mjs';
import {generateApiReference} from './api-reference/generate.mjs';
import {inlineSnippets} from './fern-mdx.mjs';
import {writeIconData} from './icons.mjs';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `MM-DD-YYYY.mdx` -> {year, month, day} */
export function parseChangelogFileName(file) {
  const match = /^(\d{2})-(\d{2})-(\d{4})\.mdx?$/.exec(path.basename(file));
  if (!match) return undefined;
  const [, month, day, year] = match.map(Number);
  return {year, month, day};
}

export function changelogEntryUrl(changelogUrl, {year, month, day}) {
  return `${changelogUrl}/${year}/${month}/${day}`;
}

export function loadSite({siteDir}) {
  const contentDir = path.join(siteDir, 'docs');
  const pagesDir = path.join(contentDir, 'pages');
  const generatedDir = path.join(pagesDir, 'generated');

  fs.rmSync(generatedDir, {recursive: true, force: true});
  fs.mkdirSync(generatedDir, {recursive: true});

  const api = generateApiReference({contentDir, pagesDir, generatedDir});
  const nav = loadNavigation({
    siteDir,
    contentDir,
    pagesDir,
    resolveApi: api.resolve,
  });

  // Docusaurus reads sidebars from a file.
  const sidebarsPath = path.join(generatedDir, 'sidebars.json');
  fs.writeFileSync(sidebarsPath, JSON.stringify(nav.sidebars, null, 2));

  const [changelogConfig] = nav.changelogs;
  if (!changelogConfig) throw new Error('navigation.yml: no changelog found');
  const overviewFile = path.join(changelogConfig.dir, 'overview.mdx');
  const description = fs.existsSync(overviewFile)
    ? fs
        .readFileSync(overviewFile, 'utf8')
        .replace(/^---[\s\S]*?---/, '')
        .trim()
    : 'Paradex release notes.';
  const changelogEntries = fs
    .readdirSync(changelogConfig.dir)
    .map((file) => ({file, date: parseChangelogFileName(file)}))
    .filter((entry) => entry.date);
  const changelog = {
    ...changelogConfig,
    description,
    entryUrls: changelogEntries.map(({date}) =>
      changelogEntryUrl(changelogConfig.url, date),
    ),
  };

  const pageByFile = new Map(nav.pages);
  for (const page of api.pages) pageByFile.set(page.file, page);

  const routes = new Set([
    ...[...pageByFile.values()].map((page) => page.url),
    changelog.url,
    ...changelog.entryUrls,
  ]);

  const redirectRules = loadRedirectRules(path.join(contentDir, 'redirects.yml'));
  const clientRedirects = expandRedirects(redirectRules, routes, nav.implicitRedirects);

  const icons = writeIconData({
    roots: [pagesDir, path.join(contentDir, 'snippets'), path.join(contentDir, 'navigation.yml'), path.join(siteDir, 'src')],
    outFile: path.join(siteDir, 'src', 'generated', 'icons.json'),
  });
  if (icons.missing.length) {
    console.warn(`[paradex] Unknown Font Awesome icons (not rendered): ${icons.missing.join(', ')}`);
  }

  /**
   * Markdown preprocessor: inline <Markdown src> snippets and point Fern's
   * <EndpointRequestSnippet endpoint="GET /path" /> at the generated data.
   */
  function preprocess({filePath, fileContent}) {
    const content = inlineSnippets(fileContent, filePath);
    return content.replace(
      /<(EndpointRequestSnippet|EndpointResponseSnippet)\s+endpoint=(?:"([^"]+)"|'([^']+)')\s*\/>/g,
      (match, component, a, b) => {
        const page = api.findOperation(a ?? b);
        if (!page) throw new Error(`${filePath}: no endpoint matches ${a ?? b}`);
        return `<${component} endpoint={require(${JSON.stringify(page.jsonFile)})} />`;
      },
    );
  }

  const docInclude = [
    ...[...nav.pages.keys()].map((file) =>
      path.relative(pagesDir, file).replace(/\\/g, '/'),
    ),
    'generated/**/*.mdx',
  ];

  async function parseFrontMatter(params) {
    const result = await params.defaultParseFrontMatter(params);
    const fm = result.frontMatter;
    const file = path.resolve(params.filePath);

    const page = pageByFile.get(file);
    if (page) {
      fm.slug = page.url;
      // Two pages capitalised the key; Fern ignored case.
      if (fm.title === undefined && fm.Title !== undefined) fm.title = fm.Title;
      delete fm.Title;
      if (fm.title === undefined) fm.title = page.title ?? page.label;
      if (fm['hide-toc'] || ['reference', 'custom'].includes(fm.layout)) {
        fm.hide_table_of_contents = true;
      }
      if (fm.description === undefined && fm.subtitle) fm.description = fm.subtitle;
      if (page.noSidebar) fm.fern_no_sidebar = true;
      if (page.isSectionLanding) fm.fern_section_landing = true;
      return result;
    }

    if (path.dirname(file) === path.resolve(changelog.dir)) {
      const date = parseChangelogFileName(file);
      if (date) {
        const {year, month, day} = date;
        fm.slug = `/${year}/${month}/${day}`;
        fm.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        fm.title ??= `${MONTHS[month - 1]} ${day}, ${year}`;
        // Fern showed no "On this page" column on a single entry.
        fm.hide_table_of_contents = true;
      }
    }
    return result;
  }

  return {
    siteDir,
    contentDir,
    pagesDir,
    generatedDir,
    sidebarsPath,
    docInclude,
    parseFrontMatter,
    preprocess,
    tabs: nav.tabs,
    navbarLinks: nav.navbarLinks,
    changelog,
    redirectRules,
    implicitRedirects: nav.implicitRedirects,
    clientRedirects,
    routes,
    pages: pageByFile,
    api,
  };
}
