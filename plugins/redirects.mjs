// Redirects from docs/redirects.yml.
//
// Rules use Fern's syntax: `/old/:slug*` matches `/old` and anything below
// it, and `:slug*` in the destination is replaced by the matched remainder.
// Rules are evaluated in order and the first match wins.
//
// A static site has no server to evaluate patterns, so the rules are
// delivered three ways:
//   1. expandRedirects() turns every rule into concrete from/to pairs for
//      every known page; @docusaurus/plugin-client-redirects writes a small
//      redirect page at each `from` path.
//   2. The rules ship to the browser, and the 404 page applies them to any
//      path that was not expanded (see src/theme/NotFound/Content).
//   3. toNetlifyRedirects() writes a `_redirects` file for hosts that support
//      server-side rules (Cloudflare Pages, Netlify). Each exact rule also
//      gets a `.md` twin (`/old.md /new.md 308`) so agents fetching the
//      Markdown of an old URL land on the new page's Markdown; wildcard
//      rules carry the `.md` suffix through `:splat` already.

import fs from 'node:fs';
import yaml from 'js-yaml';

const WILDCARD = /\/:slug\*$/;

export function loadRedirectRules(file) {
  const {redirects = []} = yaml.load(fs.readFileSync(file, 'utf8')) ?? {};
  return redirects.map(({source, destination}) => ({source, destination}));
}

/** Apply the rules to one path. Returns the destination or undefined. */
export function matchRedirect(rules, pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const {source, destination} of rules) {
    if (WILDCARD.test(source)) {
      const prefix = source.replace(WILDCARD, '');
      if (clean === prefix || clean.startsWith(prefix + '/')) {
        const rest = clean.slice(prefix.length).replace(/^\//, '');
        return destination.replace(WILDCARD, rest ? `/${rest}` : '');
      }
    } else if (clean === source) {
      return destination;
    }
  }
  return undefined;
}

const splitHash = (url) => {
  const i = url.indexOf('#');
  return i === -1 ? [url, ''] : [url.slice(0, i), url.slice(i)];
};

/**
 * Expand rules into concrete redirects.
 *
 * @param {Array<{source: string, destination: string}>} rules
 * @param {Set<string>} routes  Every URL the site serves.
 * @param {Map<string, string>} implicit  Tab/section URLs -> first page.
 */
export function expandRedirects(rules, routes, implicit) {
  const candidates = new Set(implicit.keys());
  for (const {source, destination} of rules) {
    if (!WILDCARD.test(source)) {
      candidates.add(source);
      continue;
    }
    const srcPrefix = source.replace(WILDCARD, '');
    const destPrefix = destination.replace(WILDCARD, '');
    candidates.add(srcPrefix || '/');
    // Every page under the destination prefix had an old URL under the
    // source prefix.
    for (const route of [...routes, ...implicit.keys()]) {
      if (route === destPrefix) candidates.add(srcPrefix || '/');
      else if (route.startsWith(destPrefix + '/')) {
        candidates.add(srcPrefix + route.slice(destPrefix.length));
      }
    }
  }

  const resolve = (from) => {
    // Rules first (as Fern evaluates them), then section/tab landing URLs.
    let to = matchRedirect(rules, from) ?? implicit.get(from);
    const seen = new Set([from]);
    while (to) {
      const [toPath, hash] = splitHash(to);
      if (routes.has(toPath)) return toPath + hash;
      if (seen.has(toPath)) return undefined;
      seen.add(toPath);
      const next = matchRedirect(rules, toPath) ?? implicit.get(toPath);
      if (!next) return undefined;
      to = next + (splitHash(next)[1] ? '' : hash);
    }
    return undefined;
  };

  const result = [];
  for (const from of [...candidates].sort()) {
    if (routes.has(from)) continue; // a real page always wins
    const to = resolve(from);
    if (to && to !== from) result.push({from, to});
  }
  return result;
}

/**
 * The Markdown twin of an exact redirect: `/old.md /new.md 308`, as Fern
 * answered a configured redirect on its .md route (308 for permanent
 * redirects, Location = destination + `.md`, before any #hash).
 */
function markdownRedirect(source, destination) {
  const [destPath, hash] = splitHash(destination);
  const md = (url) => `/${url.replace(/^\/+|\/+$/g, '')}.md`;
  const from = md(source);
  const to = `${md(destPath)}${hash}`;
  return `${from} ${to} 308`;
}

/**
 * Rules in Netlify / Cloudflare Pages `_redirects` syntax.
 *
 * Cloudflare Pages treats every line below the first splat (`/*`) rule as a
 * dynamic rule and ignores everything after the 100th, so the exact rules
 * (including `extra` lines) are written first and the splat rules last. An
 * exact rule that an earlier splat rule already matches could never apply
 * (matchRedirect() evaluates the rules in the same order), so it is left
 * out rather than moved above that rule; a repeated source keeps its first
 * rule.
 *
 * @param {Array<{source: string, destination: string}>} rules
 * @param {Map<string, string>} implicit  Tab/section URLs -> first page.
 * @param {string[]} [extra]  More exact lines, e.g. rewrites (`/a /b 200`).
 */
export function toNetlifyRedirects(rules, implicit, extra = []) {
  /** In evaluation order: {from, line} for exact rules, {splat, line} for prefixes. */
  const entries = [];
  const exact = (line) => entries.push({from: line.split(/\s+/)[0], line});
  for (const {source, destination} of rules) {
    if (WILDCARD.test(source)) {
      const src = source.replace(WILDCARD, '');
      const dest = destination.replace(WILDCARD, '');
      exact(`${src || '/'} ${dest || '/'} 301`);
      exact(markdownRedirect(src || '/', dest || '/'));
      entries.push({splat: src, line: `${src}/* ${dest}/:splat 301`});
    } else {
      exact(`${source} ${destination} 301`);
      exact(markdownRedirect(source, destination));
    }
  }
  for (const [from, to] of implicit) exact(`${from} ${to} 302`);
  for (const line of extra) exact(line);

  const statics = [];
  const splats = [];
  const prefixes = [];
  const seen = new Set();
  for (const entry of entries) {
    if (entry.splat !== undefined) {
      prefixes.push(entry.splat);
      splats.push(entry.line);
      continue;
    }
    if (seen.has(entry.from) || prefixes.some((prefix) => entry.from.startsWith(`${prefix}/`))) continue;
    seen.add(entry.from);
    statics.push(entry.line);
  }
  return ['# Generated from docs/redirects.yml by plugins/redirects.mjs.', ...statics, ...splats].join('\n') + '\n';
}
