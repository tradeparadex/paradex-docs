#!/usr/bin/env node
// Post-build checks (run after `yarn build`):
//   1. Every URL the site served before the move off Fern
//      (scripts/legacy-urls.txt) still resolves, to a page or a redirect
//      whose target exists.
//   2. Every redirect rule in docs/redirects.yml lands on a real page.
//   3. Every release note has its /releases/changelog/YYYY/M/D page.
//   4. Generated extras exist: llms.txt, specs, feeds, search index, 404.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

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

// 3. Changelog entries
const notesDir = path.join(root, 'docs', 'release-notes', 'prod');
let entries = 0;
for (const name of fs.readdirSync(notesDir)) {
  const m = /^(\d{2})-(\d{2})-(\d{4})\.mdx$/.exec(name);
  if (!m) continue;
  entries++;
  const url = `/releases/changelog/${Number(m[3])}/${Number(m[1])}/${Number(m[2])}`;
  if (!htmlFor(url)) fail(`missing changelog entry page ${url} (${name})`);
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
  'home.md',
  'api/prod/orders/new.md',
]) {
  if (!fs.existsSync(path.join(build, file))) fail(`missing ${file}`);
}
if (!fs.readdirSync(build).some((f) => /^search-index.*\.json$/.test(f))) fail('missing search index');

if (failures.length) {
  console.error(`✗ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${legacy.length} legacy URLs, ${redirects.length} redirect rules and ${entries} changelog entries resolve.`);
