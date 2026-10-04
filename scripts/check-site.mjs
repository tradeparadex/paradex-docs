#!/usr/bin/env node
// Post-build checks (run after `yarn build`):
//   1. Every URL the site served before the move off Fern
//      (scripts/legacy-urls.txt) still resolves, to a page or a redirect
//      whose target exists.
//   2. Every redirect rule in docs/redirects.yml lands on a real page.
//   3. Every release note has its /releases/changelog/YYYY/M/D page and a
//      page of the index in releases/changelog/anchors.json.
//   4. Generated extras exist: llms.txt, specs, feeds, search index, 404.
//   5. The build fits Cloudflare's limits (redirect rules, files, file size).
//   6. Every splat rule in _redirects sends a deep path (and its .md and
//      llms files) where the rules in docs/redirects.yml do.
//   7. Every HTML page has one viewport meta, with minimum-scale=1.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

import {llmsUrl, markdownUrl, matchRedirect} from '../plugins/redirects.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.resolve(root, process.env.BUILD_DIR ?? 'build');
const failures = [];
const fail = (message) => failures.push(message);

if (!fs.existsSync(build)) {
  console.error(`No ${path.relative(root, build)}/ directory. Run \`yarn build\` first.`);
  process.exit(1);
}

function htmlFor(url) {
  const clean = url.split('#')[0].replace(/\/+$/, '');
  const candidates = clean === '' ? ['index.html'] : [`${clean.slice(1)}.html`, `${clean.slice(1)}/index.html`];
  return candidates.map((c) => path.join(build, c)).find((f) => fs.existsSync(f));
}

function redirectTarget(file) {
  const match = /location\.replace\("([^"]+)"/.exec(fs.readFileSync(file, 'utf8'));
  return match?.[1];
}

/** Resolve a URL through redirect pages; returns the final page file or undefined. */
function resolve(url, depth = 0) {
  const file = htmlFor(url);
  if (!file) return undefined;
  const target = redirectTarget(file);
  if (!target) return file;
  if (depth > 5) return undefined;
  return resolve(target, depth + 1);
}

// 1. Legacy URLs
const legacy = fs
  .readFileSync(path.join(root, 'scripts', 'legacy-urls.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
for (const url of legacy) {
  if (!resolve(url)) fail(`legacy URL does not resolve: ${url}`);
}

// 2. Redirect rules
const {redirects = []} = yaml.load(fs.readFileSync(path.join(root, 'docs', 'redirects.yml'), 'utf8'));
for (const {source, destination} of redirects) {
  if (source.includes(':slug*')) {
    const prefix = destination.replace(/\/:slug\*$/, '');
    if (prefix && !resolve(prefix)) fail(`redirect ${source} -> ${destination}: ${prefix} does not resolve`);
  } else if (!resolve(destination)) {
    fail(`redirect ${source} -> ${destination}: target does not resolve`);
  } else if (!resolve(source)) {
    fail(`redirect source ${source} does not resolve`);
  }
}

// 3. Changelog entries, each with its date id in the index's anchor map
//    (/releases/changelog#<id> opens the page that holds the entry).
const notesDir = path.join(root, 'docs', 'release-notes', 'prod');
const anchorsFile = path.join(build, 'releases', 'changelog', 'anchors.json');
const anchors = fs.existsSync(anchorsFile) ? JSON.parse(fs.readFileSync(anchorsFile, 'utf8')) : undefined;
let entries = 0;
for (const name of fs.readdirSync(notesDir)) {
  const m = /^(\d{2})-(\d{2})-(\d{4})\.mdx$/.exec(name);
  if (!m) continue;
  entries++;
  const url = `/releases/changelog/${Number(m[3])}/${Number(m[1])}/${Number(m[2])}`;
  if (!htmlFor(url)) fail(`missing changelog entry page ${url} (${name})`);
  const dateId = `${m[3]}-${m[1]}-${m[2]}T00:00:00.000Z`;
  if (anchors && !Number.isInteger(anchors[dateId])) fail(`releases/changelog/anchors.json has no page for #${dateId} (${name})`);
}

// 4. Generated extras
for (const file of [
  '404.html',
  '_redirects',
  'llms.txt',
  'llms-full.txt',
  'openapi.json',
  'openapi.yaml',
  'asyncapi.json',
  'asyncapi.yaml',
  'sitemap.xml',
  'releases/changelog/rss.xml',
  'releases/changelog/atom.xml',
  'releases/changelog/llms.txt',
  'releases/changelog/anchors.json',
  'home.md',
  'api/prod/orders/new.md',
  '_headers',
  '_mcp/search-index.json',
  '.well-known/api-catalog',
]) {
  if (!fs.existsSync(path.join(build, file))) fail(`missing ${file}`);
}

// Cloudflare's static assets take up to 2,000 static _redirects rules and
// 100 dynamic ones. Every line below the first splat rule counts as dynamic;
// rules past either limit are ignored without an error.
if (fs.existsSync(path.join(build, '_redirects'))) {
  const rules = fs
    .readFileSync(path.join(build, '_redirects'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));
  const firstSplat = rules.findIndex((line) => line.split(/\s+/)[0].includes('*'));
  const dynamic = firstSplat < 0 ? 0 : rules.length - firstSplat;
  if (dynamic > 100) fail(`_redirects has ${dynamic} lines from the first splat rule on (Cloudflare reads 100)`);
  if (rules.length - dynamic > 2000) fail(`_redirects has ${rules.length - dynamic} static rules (Cloudflare reads 2,000)`);

  // Cloudflare answers _redirects before any redirect page is served, so a
  // splat rule that disagrees with matchRedirect() (which the redirect pages
  // and the 404 page use) is what visitors get. Match like Cloudflare: the
  // first line whose pattern matches, `*` greedy, `:splat` replaced.
  const lines = rules.map((line) => line.split(/\s+/));
  const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const answer = (pathname) => {
    for (const [from, to] of lines) {
      const m = new RegExp(`^${from.split('*').map(escapeRegex).join('(?<splat>.*)')}$`).exec(pathname);
      if (m) return to.replaceAll(':splat', m.groups?.splat ?? '');
    }
  };
  // Each splat line's prefix and a deep path below it are sampled as a page,
  // its .md and its llms files, which follow the page's destination.
  const formats = [
    ['', (to) => to],
    ['.md', markdownUrl],
    ['/llms.txt', (to) => llmsUrl(to)],
    ['/llms-full.txt', (to) => llmsUrl(to, 'llms-full.txt')],
  ];
  const pages = new Set();
  for (const [from] of lines.filter(([from]) => from.includes('*'))) {
    pages.add(from.split('/*')[0]);
    pages.add(from.replace('*', 'x/y').replace(/(\.md|\/llms(-full)?\.txt)$/, ''));
  }
  for (const page of pages) {
    const to = matchRedirect(redirects, page);
    for (const [suffix, format] of formats) {
      const url = page + suffix;
      const expected = to && format(to);
      const actual = answer(url);
      if (actual !== expected) fail(`_redirects sends ${url} to ${actual}; docs/redirects.yml sends it to ${expected}`);
    }
  }
}

// Cloudflare refuses to deploy more than 20,000 asset files (Workers Free;
// Paid allows 100,000) or any file over 25 MiB.
{
  let files = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        files++;
        const size = fs.statSync(full).size;
        if (size > 25 * 1024 * 1024) fail(`${path.relative(build, full)} is ${(size / 1024 / 1024).toFixed(1)} MiB (Cloudflare's limit is 25 MiB)`);
      }
    }
  };
  walk(build);
  if (files > 20000) fail(`build has ${files} files (Cloudflare's Workers Free limit is 20,000)`);
}
if (!fs.readdirSync(build).some((f) => /^search-index.*\.json$/.test(f))) fail('missing search index');

// 7. Viewport meta. Without minimum-scale=1, content wider than a phone
// widens the layout viewport and the mobile drawer and search dialog open
// off-screen. docusaurus.config.ts replaces Docusaurus's default tag.
{
  const bad = [];
  for (const file of fs.readdirSync(build, {recursive: true})) {
    if (!file.endsWith('.html')) continue;
    const metas = fs.readFileSync(path.join(build, file), 'utf8').match(/<meta[^>]*\sname=["']?viewport(?=["'\s/>])[^>]*>/g) ?? [];
    if (metas.length !== 1) bad.push(`${file} (${metas.length} viewport metas)`);
    else if (!/minimum-scale=1(\.0*)?(?![.\d])/.test(metas[0])) bad.push(`${file} (no minimum-scale=1)`);
  }
  if (bad.length) fail(`${bad.length} HTML pages need exactly one viewport meta with minimum-scale=1: ${bad.slice(0, 5).join(', ')}`);
}

if (failures.length) {
  console.error(`✗ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${legacy.length} legacy URLs, ${redirects.length} redirect rules and ${entries} changelog entries resolve.`);
