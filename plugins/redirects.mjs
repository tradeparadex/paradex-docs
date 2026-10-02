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
//      server-side rules (Cloudflare Pages, Netlify).

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

/** Rules in Netlify / Cloudflare Pages `_redirects` syntax. */
export function toNetlifyRedirects(rules, implicit) {
  const lines = ['# Generated from docs/redirects.yml by plugins/redirects.mjs.'];
  for (const {source, destination} of rules) {
    if (WILDCARD.test(source)) {
      const src = source.replace(WILDCARD, '');
      const dest = destination.replace(WILDCARD, '');
      lines.push(`${src || '/'} ${dest || '/'} 301`);
      lines.push(`${src}/* ${dest}/:splat 301`);
    } else {
      lines.push(`${source} ${destination} 301`);
    }
  }
  for (const [from, to] of implicit) lines.push(`${from} ${to} 302`);
  return lines.join('\n') + '\n';
}
