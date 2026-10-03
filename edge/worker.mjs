// Standalone Cloudflare Worker entry: runs the edge layer (core.mjs) in front
// of another origin that serves the static build, such as GitHub Pages.
// Deploy with edge/wrangler.worker.toml (see edge/README.md).
//
// Environment:
//   ORIGIN            where the static build is served, e.g.
//                     https://tradeparadex.github.io/paradex-docs. Leave unset
//                     when the Worker runs on a route of the site's own zone:
//                     fetch() to the same host then goes to the origin server.
//   SITE_URL          public base URL (default https://docs.paradex.trade)
//   DOCS_MCP_SERVER   "off" turns the MCP server off
//   SEARCH_INDEX_TTL  seconds a loaded search index is reused (default 600),
//                     since the origin can redeploy while the isolate lives on

import { handle, needsEdge } from './core.mjs';
import { collapseSlashes, trimTrailingSlashes } from './paths.mjs';

const DEFAULT_INDEX_TTL_SECONDS = 600;

/**
 * Maps a URL or path of the public site to the same file on ORIGIN (or on
 * the request's own origin when ORIGIN is unset).
 *
 * The result is never resolved as a URL reference: it starts from the fixed
 * origin and only its pathname and search are set, so a path such as
 * "//evil.example/x" or "/\evil.example/x" stays a path on that origin
 * (repeated slashes are collapsed too) and can never name another host.
 */
export function originUrl(input, requestUrl, origin) {
  const base = new URL(origin ?? requestUrl);
  let pathname;
  let search;
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
    const parsed = new URL(input);
    pathname = parsed.pathname;
    search = parsed.search;
  } else {
    const q = input.indexOf('?');
    pathname = q < 0 ? input : input.slice(0, q);
    search = q < 0 ? '' : input.slice(q);
  }
  const prefix = origin ? trimTrailingSlashes(base.pathname) : '';
  const url = new URL(base.origin);
  url.pathname = `${prefix}${collapseSlashes(`/${pathname}`)}`;
  url.search = search;
  if (url.origin !== base.origin) throw new Error(`Refusing to fetch outside ${base.origin}`);
  return url;
}

export default {
  fetch(request, env = {}) {
    const origin = typeof env.ORIGIN === 'string' && env.ORIGIN.trim() !== '' ? env.ORIGIN.trim() : null;
    const passThrough = () =>
      origin ? fetch(new Request(originUrl(request.url, request.url, origin), request)) : fetch(request);
    if (!needsEdge(request)) return passThrough();
    const ttl = Number(env.SEARCH_INDEX_TTL ?? DEFAULT_INDEX_TTL_SECONDS);
    return handle(request, {
      siteUrl: env.SITE_URL,
      mcpServer: env.DOCS_MCP_SERVER,
      indexTtlMs: Number.isFinite(ttl) && ttl >= 0 ? ttl * 1000 : DEFAULT_INDEX_TTL_SECONDS * 1000,
      fetchAsset: (path) =>
        fetch(originUrl(typeof path === 'string' ? path : path.url, request.url, origin), {
          // Let Cloudflare cache origin files for a few minutes (ignored elsewhere).
          cf: { cacheEverything: true, cacheTtl: 300 },
        }),
      next: passThrough,
    });
  },
};
