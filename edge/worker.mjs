// Cloudflare Worker entry for docs.paradex.trade. The Docusaurus build is the
// Worker's static assets (wrangler.toml [assets]); this Worker runs the edge
// layer (core.mjs) in front of them. `/assets/*` never reaches it
// (run_worker_first), and requests that need nothing from it (HTML pages
// fetched by browsers, robots.txt, sitemaps) go straight to the assets after
// a cheap URL/header check. The assets apply the build's `_redirects` and
// `_headers` and serve 404.html for unknown paths.
//
// Environment (wrangler.toml [vars]):
//   SITE_URL         public base URL (default https://docs.paradex.trade)
//   DOCS_MCP_SERVER  "off" turns the MCP server off (404, like Fern's switch)

import { handle, needsEdge } from './core.mjs';

/**
 * A request for one file of the build. The URL keeps the request's origin and
 * only takes the path, so a path can never be read as another host.
 */
function assetRequest(path, requestUrl) {
  const url = new URL(requestUrl);
  url.pathname = path;
  url.search = '';
  // redirect: 'manual' so a `_redirects` rule (for example a legacy
  // `/old.md /new.md 308`) reaches the client as a redirect, as on Fern,
  // instead of being followed and served under the old URL.
  return new Request(url, { redirect: 'manual' });
}

export default {
  fetch(request, env) {
    const next = () => env.ASSETS.fetch(request);
    if (!needsEdge(request)) return next();
    return handle(request, {
      siteUrl: env.SITE_URL,
      mcpServer: env.DOCS_MCP_SERVER,
      fetchAsset: (path) => env.ASSETS.fetch(assetRequest(path, request.url)),
      next,
    });
  },
};
