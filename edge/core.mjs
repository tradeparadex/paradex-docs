// Host-agnostic edge layer for docs.paradex.trade (Web-standard Request ->
// Response, no Node APIs, no dependencies). It adds what Fern's servers did
// on top of the static build:
//
// - the docs MCP server at /_mcp/server (and the legacy POST/DELETE /mcp);
// - Accept negotiation: page URLs requested with text/plain or text/markdown
//   get a 303 to <page>.md;
// - .md / .mdx: agent Markdown with Fern's headers, /.md -> the home page,
//   ?lang= / ?excludeSpec= filters, and a 200 "Page Not Found" with similar
//   pages for unknown paths;
// - llms.txt / llms-full.txt: Content-Type by Accept, Vary, cache headers and
//   the agent not-found;
// - /.well-known/api-catalog with RFC 9727 headers.
// Everything else goes to next() untouched.
//
// Entry point: edge/worker.mjs, a Cloudflare Worker whose static assets are
// the build.

import { handleMcp, MCP_PATH } from './mcp.mjs';
import { agentFilterOptions, filterAgentMarkdown, hasAgentFilter, notFoundBody, suggestRoutes } from './markdown.mjs';
import { collapseSlashes, trimTrailingSlashes } from './paths.mjs';
import { buildSearchIndex, searchIndex } from './search.mjs';

export const DEFAULT_SITE_URL = 'https://docs.paradex.trade';
export const SEARCH_INDEX_PATH = '/_mcp/search-index.json';
export const HOME_PAGE = '/home';

const AGENT_CACHE_CONTROL = 'public, max-age=300, s-maxage=31536000, stale-while-revalidate=31536000';
const CATALOG_CACHE_CONTROL = 'public, s-maxage=31536000, stale-while-revalidate=31536000';
const LINKSET_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';
const API_CATALOG_PATH = '/.well-known/api-catalog';

/** API references listed by /.well-known/api-catalog when the build ships no file. */
export const DEFAULT_API_REFERENCES = [
  { path: '/api/prod', spec: '/openapi/rest-endpoints.yaml' },
  { path: '/api/testnet', spec: '/openapi/rest-endpoints-2.yaml' },
];

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_FETCH_REDIRECTS = 5;

const MARKDOWN_SUFFIX = /\.mdx?$/;
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/;

function isMcpPath(pathname) {
  return pathname.endsWith(MCP_PATH) || pathname.endsWith(`${MCP_PATH}/`);
}

/** The legacy MCP alias: /mcp, with trailing slashes ignored as Fern did. */
function isLegacyMcpPath(pathname) {
  return trimTrailingSlashes(pathname) === '/mcp';
}

function wantsMarkdown(request) {
  const accept = request.headers.get('accept');
  return accept !== null && (accept.includes('text/plain') || accept.includes('text/markdown'));
}

/**
 * Whether a path is a page URL that Accept negotiation may send to its .md.
 * Excluded: llms files, .md/.mdx, /.well-known, /_mcp and /mcp, and any path
 * whose last segment has a file extension (robots.txt, sitemaps, favicon,
 * OpenAPI/AsyncAPI files, feeds, assets).
 */
export function isNegotiablePath(pathname) {
  if (pathname.endsWith('/llms.txt') || pathname.endsWith('/llms-full.txt')) return false;
  if (MARKDOWN_SUFFIX.test(pathname)) return false;
  if (pathname.startsWith('/.well-known/') || pathname.includes('/.well-known/')) return false;
  if (pathname === '/_mcp' || pathname.startsWith('/_mcp/') || isLegacyMcpPath(pathname)) return false;
  if (pathname.startsWith('/cdn-cgi/')) return false;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !FILE_EXTENSION.test(last);
}

/**
 * Cheap pre-check for the hosting adapters: false means handle() would only
 * pass the request through, so the adapter can call next() directly.
 */
export function needsEdge(request) {
  const { pathname } = new URL(request.url);
  if (isMcpPath(pathname) || isLegacyMcpPath(pathname)) return true;
  if (MARKDOWN_SUFFIX.test(pathname)) return true;
  if (pathname.endsWith('/llms.txt') || pathname.endsWith('/llms-full.txt')) return true;
  if (pathname.endsWith(API_CATALOG_PATH)) return true;
  const m = request.method;
  return (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') && wantsMarkdown(request) && isNegotiablePath(pathname);
}

function normalizeSiteUrl(value) {
  const raw = typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

function isEnabled(value) {
  return !(typeof value === 'string' && ['off', 'false', '0', 'no', 'disabled'].includes(value.trim().toLowerCase()));
}

function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } });
}

function withoutBody(response) {
  response.body?.cancel?.().catch(() => {});
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** A static host answers a missing file with 404 (or an HTML fallback page). */
function isMissing(response, path) {
  if (response.status === 404 || response.status === 410) return true;
  const type = response.headers.get('content-type') ?? '';
  return response.ok && type.includes('text/html') && !/\.html?$/.test(path);
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * /x.md and /x.mdx -> /x.md; /.md -> /home.md; /x/.md -> /x.md. Repeated
 * slashes are collapsed, so the asset path never starts with "//".
 */
export function markdownAssetPath(pathname) {
  let base = trimTrailingSlashes(collapseSlashes(pathname).replace(MARKDOWN_SUFFIX, ''));
  if (base === '') base = HOME_PAGE;
  return { assetPath: `${base}.md`, slug: safeDecode(base.slice(1)) };
}

/**
 * Fern's .md redirect: 308 for a permanent redirect, 307 otherwise, with
 * the request's query kept and X-Robots-Tag: noindex.
 */
function markdownRedirect(location, status, url) {
  const target = new URL(location, url);
  if (target.search === '' && url.search !== '') target.search = url.search;
  const permanent = status === 301 || status === 308;
  return new Response(null, {
    status: permanent ? 308 : 307,
    headers: { Location: target.href, 'X-Robots-Tag': 'noindex' },
  });
}

/**
 * Creates an edge handler with its own search-index cache. The module-level
 * `handle` uses one shared instance, so the index is loaded once per isolate.
 */
export function createEdge() {
  const state = { data: null, index: null };
  const stats = { indexBuilds: 0 };

  // The index never changes under a running isolate: a deploy is a new
  // Worker version with its own assets and isolates.
  function loadIndexData(ctx) {
    if (state.data !== null) return Promise.resolve(state.data);
    // One load per request: a JSON-RPC batch of searchDocs calls on a cold
    // isolate shares it instead of fetching and parsing the file per call.
    // The promise lives on the request's ctx, never on `state`, so requests
    // do not wait on each other's request-bound I/O.
    return (ctx.indexLoad ??= (async () => {
      const res = await ctx.fetchAsset(SEARCH_INDEX_PATH);
      if (!res.ok || isMissing(res, SEARCH_INDEX_PATH)) {
        res.body?.cancel?.().catch(() => {});
        throw new Error(`Search index is unavailable (status ${res.status})`);
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.pages) || !Array.isArray(data.sections)) throw new Error('Search index is malformed');
      // Requests that started loading together (a cold isolate) each fetch
      // the file once, but the first copy stored wins, so the index is
      // built once.
      if (state.data !== null) return state.data;
      state.data = data;
      state.index = null;
      return data;
    })());
  }

  async function loadIndex(ctx) {
    const data = await loadIndexData(ctx);
    if (state.index === null || state.index.source !== data) {
      state.index = { source: data, built: buildSearchIndex(data) };
      stats.indexBuilds++;
    }
    return state.index.built;
  }

  async function suggestionsFor(slug, ctx) {
    try {
      const data = await loadIndexData(ctx);
      return suggestRoutes(slug, data.pages);
    } catch {
      return [];
    }
  }

  function agentNotFound(ctx, suggestions) {
    return new Response(notFoundBody(ctx.siteUrl, suggestions), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  /** GET semantics of a .md/.mdx URL; shared by the route and fetchPage. */
  async function markdownResponse(url, ctx) {
    const { assetPath, slug } = markdownAssetPath(url.pathname);
    const asset = await ctx.fetchAsset(assetPath);
    // Cloudflare applied a `_redirects` rule.
    if (REDIRECT_STATUSES.has(asset.status) && asset.headers.has('location')) {
      asset.body?.cancel?.().catch(() => {});
      return markdownRedirect(asset.headers.get('location'), asset.status, url);
    }
    if (isMissing(asset, assetPath)) {
      asset.body?.cancel?.().catch(() => {});
      return agentNotFound(ctx, await suggestionsFor(slug, ctx));
    }
    if (!asset.ok) return asset;
    const headers = {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': AGENT_CACHE_CONTROL,
    };
    const filter = agentFilterOptions(url.searchParams);
    if (!hasAgentFilter(filter)) return new Response(asset.body, { status: 200, headers });
    return new Response(filterAgentMarkdown(await asset.text(), filter), { status: 200, headers });
  }

  async function serveMarkdown(request, url, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: { 'X-Robots-Tag': 'noindex', Allow: 'OPTIONS, GET' } });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
    const response = await markdownResponse(url, ctx);
    return request.method === 'HEAD' ? withoutBody(response) : response;
  }

  async function serveLlmsTxt(request, url, ctx, full) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, HEAD, OPTIONS' } });
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
    const assetPath = collapseSlashes(url.pathname);
    const asset = await ctx.fetchAsset(assetPath);
    let response;
    if (isMissing(asset, assetPath)) {
      asset.body?.cancel?.().catch(() => {});
      if (full) {
        // Fern: <prefix>/llms-full.txt -> 301 <prefix>/llms.txt (query dropped).
        const target = `${url.origin}${assetPath.replace(/\/llms-full\.txt$/, '/llms.txt')}`;
        return new Response(null, { status: 301, headers: { Location: target } });
      }
      response = agentNotFound(ctx, []);
    } else if (!asset.ok) {
      response = asset;
    } else {
      const accept = request.headers.get('accept');
      const headers = {
        'Content-Type': accept?.includes('text/markdown') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
        Vary: 'Accept',
        'Cache-Control': AGENT_CACHE_CONTROL,
      };
      const filter = agentFilterOptions(url.searchParams);
      const body = hasAgentFilter(filter) ? filterAgentMarkdown(await asset.text(), filter) : asset.body;
      response = new Response(body, { status: 200, headers });
    }
    return request.method === 'HEAD' ? withoutBody(response) : response;
  }

  async function serveApiCatalog(request, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, HEAD, OPTIONS' } });
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed();
    const headers = {
      'Content-Type': LINKSET_TYPE,
      Link: `<${ctx.siteUrl}${API_CATALOG_PATH}>; rel="api-catalog"`,
      'Cache-Control': CATALOG_CACHE_CONTROL,
    };
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    const asset = await ctx.fetchAsset(API_CATALOG_PATH);
    let body;
    if (asset.ok && !isMissing(asset, API_CATALOG_PATH)) {
      body = await asset.text();
    } else {
      asset.body?.cancel?.().catch(() => {});
      body = JSON.stringify({
        linkset: ctx.apiReferences.map((ref) => ({
          anchor: `${ctx.siteUrl}${ref.path}`,
          'service-desc': [{ href: `${ctx.siteUrl}${ref.spec}`, type: 'application/yaml' }],
          'service-doc': [{ href: `${ctx.siteUrl}${ref.path}`, type: 'text/html' }],
        })),
      });
    }
    return new Response(body, { status: 200, headers });
  }

  function mcpDeps(ctx) {
    return {
      siteUrl: ctx.siteUrl,
      enabled: ctx.mcpEnabled,
      searchDocs: async (query, topK) => searchIndex(await loadIndex(ctx), query, topK, ctx.siteUrl),
      // Like Fern's fetch() of the .md URL, follow redirects on this site
      // (a legacy URL's Markdown answers 308 to the new page's).
      fetchMarkdown: async (markdownUrl) => {
        let url = new URL(markdownUrl);
        let response = await markdownResponse(url, ctx);
        for (let hops = 0; hops < MAX_FETCH_REDIRECTS && REDIRECT_STATUSES.has(response.status); hops++) {
          const location = response.headers.get('location');
          if (!location) break;
          const next = new URL(location, url);
          if (next.origin !== url.origin || !MARKDOWN_SUFFIX.test(next.pathname)) break;
          url = next;
          response = await markdownResponse(url, ctx);
        }
        return response;
      },
    };
  }

  /**
   * handle(request, options)
   *   options.siteUrl       public base URL (default https://docs.paradex.trade)
   *   options.fetchAsset    (path) => Response for a file of the static build
   *   options.next          () => Response for pass-through (default: fetchAsset(request))
   *   options.mcpServer     "off" disables the MCP server (Fern's kill switch)
   *   options.apiReferences fallback api-catalog entries [{path, spec}]
   */
  async function handle(request, options = {}) {
    if (typeof options.fetchAsset !== 'function') throw new TypeError('handle() needs options.fetchAsset');
    const ctx = {
      siteUrl: normalizeSiteUrl(options.siteUrl),
      fetchAsset: options.fetchAsset,
      mcpEnabled: isEnabled(options.mcpServer),
      apiReferences: options.apiReferences ?? DEFAULT_API_REFERENCES,
    };
    const next = () => (typeof options.next === 'function' ? options.next() : options.fetchAsset(request));
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (isMcpPath(pathname) || (isLegacyMcpPath(pathname) && (method === 'POST' || method === 'DELETE'))) {
      return handleMcp(request, mcpDeps(ctx));
    }
    if (pathname.endsWith(API_CATALOG_PATH)) return serveApiCatalog(request, ctx);
    if ((method === 'GET' || method === 'HEAD' || method === 'OPTIONS') && wantsMarkdown(request) && isNegotiablePath(pathname)) {
      const page = trimTrailingSlashes(pathname) || '/';
      return new Response(null, { status: 303, headers: { Location: `${url.origin}${page}.md${url.search}` } });
    }
    if (pathname.endsWith('/llms-full.txt')) return serveLlmsTxt(request, url, ctx, true);
    if (pathname.endsWith('/llms.txt')) return serveLlmsTxt(request, url, ctx, false);
    if (MARKDOWN_SUFFIX.test(pathname)) return serveMarkdown(request, url, ctx);
    return next();
  }

  function resetCache() {
    state.data = null;
    state.index = null;
  }

  return { handle, resetCache, stats };
}

const shared = createEdge();

/** Handles one request with the isolate-wide shared search-index cache. */
export function handle(request, options) {
  return shared.handle(request, options);
}
