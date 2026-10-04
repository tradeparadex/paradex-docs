// /_mcp/search-index.json: the index the docs MCP server (edge/) searches
// for its searchDocs tool. Built after the HTML, so section anchors are the
// ids the pages really use.
//
//   {"version": 1, "site": "https://docs.paradex.trade",
//    "pages": [{"url", "title", "kind": "page"|"api"|"changelog", "breadcrumbs": [...],
//               "navTitle"?: <the navigation's title, when it differs>}],
//    "sections": [{"page": <index into pages>, "anchor": "<id>"|null,
//                  "heading": "<text>"|null, "text": "<plain text, <= 4000 chars>"}]}
//
// One section per H2/H3 of a page, plus the page intro (anchor null). API
// pages use the anchors of the reference layout (request.auth,
// request.path, request.query, request.header, request, response,
// response.error, send.publish, receive.subscribe); their intro holds the
// method and path. Hidden pages, unpublished drafts and the testnet copies
// of production endpoints (same canonical URL) are left out.

import fs from 'node:fs';
import path from 'node:path';
import {fromHtml} from 'hast-util-from-html';

import {ancestorsOf, isApiLeaf} from './llms-nav.mjs';

const MAX_TEXT = 4000;
const SKIP_TAGS = new Set(['script', 'style', 'svg', 'button', 'nav', 'noscript', 'template', 'img', 'iframe']);
const SKIP_CLASSES = ['hash-link', 'page-actions', 'theme-doc-toc-mobile', 'fern-page-header', 'theme-code-block__copy', 'clean-btn'];
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'tr', 'table', 'thead', 'tbody', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'details', 'summary', 'header', 'footer', 'dl', 'dt', 'dd', 'figure', 'figcaption']);

const classList = (node) => {
  const value = node.properties?.className;
  return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : [];
};

function cleanText(text) {
  const out = text
    .replace(/[\u200b\u00a0]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return out.length > MAX_TEXT ? out.slice(0, MAX_TEXT - 1).trimEnd() + '…' : out;
}

function findElement(node, predicate) {
  if (node.type === 'element' && predicate(node)) return node;
  for (const child of node.children ?? []) {
    const hit = findElement(child, predicate);
    if (hit) return hit;
  }
  return undefined;
}

/** Plain text of a heading, without the "#" anchor link. */
function headingText(node) {
  let out = '';
  const walk = (n) => {
    if (n.type === 'text') out += n.value;
    if (n.type !== 'element' && n.type !== 'root') return;
    if (n.type === 'element' && (SKIP_TAGS.has(n.tagName) || classList(n).some((c) => SKIP_CLASSES.includes(c)))) return;
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return out.replace(/[\u200b]/g, '').replace(/\s+/g, ' ').trim();
}

/** Split a rendered page body into sections at every h2/h3 with an id. */
function sectionsFromHtml(container, intro = '') {
  const sections = [{anchor: null, heading: null, parts: intro ? [intro, '\n'] : []}];
  const walk = (node) => {
    if (node.type === 'text') {
      sections[sections.length - 1].parts.push(node.value);
      return;
    }
    if (node.type !== 'element') return;
    const tag = node.tagName;
    if (SKIP_TAGS.has(tag) || classList(node).some((c) => SKIP_CLASSES.includes(c))) return;
    if (node.properties?.style && /display:\s*none/.test(String(node.properties.style))) return;
    if ((tag === 'h2' || tag === 'h3') && node.properties?.id) {
      sections.push({anchor: String(node.properties.id), heading: headingText(node), parts: []});
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) sections[sections.length - 1].parts.push('\n');
    if (tag === 'td' || tag === 'th') sections[sections.length - 1].parts.push(' ');
    for (const child of node.children ?? []) walk(child);
    if (block) sections[sections.length - 1].parts.push('\n');
  };
  for (const child of container.children ?? []) walk(child);
  return sections
    .map(({anchor, heading, parts}) => ({anchor, heading, text: cleanText(parts.join(''))}))
    .filter((s, i) => i === 0 || s.text || s.heading);
}

function htmlFile(outDir, url) {
  const clean = url.replace(/^\//, '');
  const candidates = clean === '' ? ['index.html'] : [`${clean}.html`, path.join(clean, 'index.html')];
  return candidates.map((c) => path.join(outDir, c)).find((f) => fs.existsSync(f));
}

/**
 * @param {object} options
 * @param {ReturnType<import('./llms-nav.mjs').buildNavTree>} options.tree
 * @param {(node: object) => string} options.titleOf  Page title for a node.
 * @param {(page: object) => Array<{anchor: string|null, heading: string|null, text: string}>} options.apiSections
 * @param {(node: object) => string|undefined} options.introOf  Text before the body (subtitle).
 */
export function buildSearchIndex({tree, outDir, siteUrl, titleOf, apiSections, introOf}) {
  const pages = [];
  const sections = [];
  const seen = new Set();
  let failures = 0;

  for (const node of tree.nodes) {
    const listed = node.type === 'page' || (node.type === 'section' && node.page) || node.type === 'changelog' || node.type === 'changelogEntry' || isApiLeaf(node);
    if (!listed) continue;
    if (node.hidden || ancestorsOf(node).some((a) => a.hidden)) continue;
    if (isApiLeaf(node) && node.canonicalUrl !== node.url) continue;
    if (seen.has(node.url)) continue;
    seen.add(node.url);

    const kind = isApiLeaf(node) ? 'api' : node.type === 'changelog' || node.type === 'changelogEntry' ? 'changelog' : 'page';
    const breadcrumbs = ancestorsOf(node)
      .filter((a) => a.type !== 'root' && a.type !== 'apiReference')
      .map((a) => a.title);
    const index = pages.length;
    let pageSections;
    try {
      if (isApiLeaf(node)) {
        pageSections = apiSections(node.page);
      } else if (node.type === 'changelog') {
        pageSections = [{anchor: null, heading: null, text: cleanText(introOf(node) ?? '')}];
      } else {
        const file = htmlFile(outDir, node.url);
        if (!file) continue;
        const tree = fromHtml(fs.readFileSync(file, 'utf8'));
        const container =
          findElement(tree, (n) => n.properties?.id === '__blog-post-container') ??
          findElement(tree, (n) => classList(n).includes('theme-doc-markdown'));
        if (!container) continue;
        pageSections = sectionsFromHtml(container, introOf(node));
      }
    } catch (error) {
      failures++;
      console.warn(`[paradex] search index: ${node.url}: ${error.message}`);
      continue;
    }
    const title = titleOf(node);
    // The 404 page's suggestions show the sidebar title, as Fern's did.
    pages.push({url: node.url, title, kind, breadcrumbs, ...(node.title && node.title !== title ? {navTitle: node.title} : {})});
    for (const s of pageSections) sections.push({page: index, anchor: s.anchor ?? null, heading: s.heading ?? null, text: cleanText(s.text ?? '')});
  }
  if (failures) console.warn(`[paradex] search index: ${failures} page(s) skipped`);
  return {version: 1, site: siteUrl, pages, sections};
}
