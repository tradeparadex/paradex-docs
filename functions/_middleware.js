// Cloudflare Pages Functions entry: runs the edge layer (edge/core.mjs) in
// front of the static build. Requests that need nothing from it (HTML pages
// fetched by browsers, JS, CSS, images) go straight to next() after a cheap
// URL/header check.
//
// Environment (Pages project settings or wrangler.toml [vars]):
//   SITE_URL         public base URL (default https://docs.paradex.trade)
//   DOCS_MCP_SERVER  "off" turns the MCP server off (404, like Fern's switch)

import { handle, needsEdge } from '../edge/core.mjs';

function assetUrl(path, requestUrl) {
  const url = new URL(requestUrl);
  url.pathname = path;
  url.search = '';
  return url;
}

export function onRequest(context) {
  const { request, env, next } = context;
  if (!needsEdge(request)) return next();
  return handle(request, {
    siteUrl: env.SITE_URL,
    mcpServer: env.DOCS_MCP_SERVER,
    // redirect: 'manual' so a `_redirects` rule (for example a legacy
    // `/old.md /new.md 308`) reaches the client as a redirect, as on Fern,
    // instead of being followed and served under the old URL.
    // The asset URL keeps the request's origin and only takes the path, so a
    // path can never be read as another host.
    fetchAsset: (path) => env.ASSETS.fetch(new Request(typeof path === 'string' ? assetUrl(path, request.url) : path, { redirect: 'manual' })),
    next,
  });
}
