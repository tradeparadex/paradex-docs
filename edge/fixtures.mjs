// In-memory fixture site for the edge tests: a few .md pages in Fern's agent
// format, llms.txt files and a small search index.

export const SITE = 'https://docs.paradex.trade';

export const PREAMBLE = [
  '> For clean Markdown of any page, append .md to the page URL.',
  `> For a complete documentation index, see ${SITE}/llms.txt.`,
  `> For AI client integration (Claude Code, Cursor, etc.), connect to the MCP server at ${SITE}/_mcp/server.`,
].join('\n');

const fence = (info, ...code) => ['```' + info, ...code, '```'].join('\n');
const doc = (...blocks) => blocks.join('\n\n');

export const HOME_MD = doc(PREAMBLE, '# Zero-fee Trading', 'Trade perps, options and spot from one account.');

export const WHAT_IS_MD = doc(
  PREAMBLE,
  '# What is Paradex?',
  'Paradex is a zero-fee perpetuals exchange built on its own appchain.',
  '## Privacy',
  'Positions and PnL are private.',
);

export const CREATE_ORDER_MD = doc(
  PREAMBLE,
  '# Create order',
  'POST https://api.prod.paradex.trade/v1/orders\nContent-Type: application/json',
  'Open a new order.',
  `Reference: ${SITE}/api/prod/orders/new`,
  '## Authentication',
  '- `Authorization` header (required) — API Key authentication via header',
  '## Request',
  '### Body (application/json)',
  'This endpoint expects an object.',
  '- `market` (string, required) — Market symbol, e.g. BTC-USD-PERP\n- `instruction` (enum, required) — Order instruction\n  - Allowed values: `GTC`, `POST_ONLY`, `IOC`, `RPI`',
  '## Response',
  '### 201',
  'Created',
  '- `id` (string, optional) — Order id',
  '## Errors',
  '### 400 Bad Request',
  'Bad Request',
  '- `error` (string, optional) — Error code',
  '## Types',
  '### responses.RequestInfo',
  '- `id` (string, optional) — Request id',
  '## Examples',
  '**Request**',
  fence('json', '{', '  "market": "BTC-USD-PERP"', '}'),
  '**Response**',
  fence('json', '{', '  "id": "123"', '}'),
  '**Code Samples**',
  fence('python', 'import requests'),
  fence('curl', 'curl -X POST https://api.prod.paradex.trade/v1/orders'),
  fence('javascript', 'fetch("https://api.prod.paradex.trade/v1/orders")'),
  fence('go', 'http.Post("https://api.prod.paradex.trade/v1/orders")'),
  '**SDK Code**',
  fence('python Create order', 'client.create_order()'),
  fence('typescript Create order', 'await client.createOrder()'),
);

/** Page-level llms.txt of an endpoint page: its .md, then "> subtitle". */
export const CREATE_ORDER_LLMS = `${CREATE_ORDER_MD}\n\n> Open a new order.\n\n`;

export const WS_ORDERS_MD = doc(
  PREAMBLE,
  '# orders.{market_symbol}',
  'GET /orders.{market_symbol}',
  'Private channel with order updates.',
  `Reference: ${SITE}/ws/web-socket-channels/orders-market-symbol/orders-market-symbol`,
  '## AsyncAPI Specification',
  fence('yaml', 'asyncapi: 2.6.0', 'info:', '  title: WebSocket', '## not a heading'),
);

export const QUICK_START_MD = doc(
  PREAMBLE,
  '# API quick start',
  '> Make your first request.',
  'Start with the public markets endpoint.',
  '### Request',
  'GET https://api.prod.paradex.trade/v1/markets',
  fence('curl', 'curl https://api.prod.paradex.trade/v1/markets'),
  fence('python', 'requests.get("https://api.prod.paradex.trade/v1/markets")'),
  fence('javascript', 'fetch("https://api.prod.paradex.trade/v1/markets")'),
  '### Response (200)',
  fence('json', '{"results": []}'),
);

export const ROOT_LLMS = [
  '# Paradex | Documentation',
  '',
  '## Instructions for AI Agents',
  '',
  '- For clean Markdown of any page, append `.md` to the page URL',
  '- For section-specific indexes, append `/llms.txt` to any section URL',
  `- For AI client integration (Claude Code, Cursor, etc.), connect to the MCP server at ${SITE}/_mcp/server`,
  '',
  '## Docs',
  '',
  `- [What is Paradex?](${SITE}/docs/getting-started/what-is-paradex.md)`,
  '',
].join('\n');

export const API_SECTION_LLMS = doc(
  PREAMBLE,
  '# API',
  `## Docs\n\n- [API quick start](${SITE}/api/general-information/api-quick-start.md)`,
  `## API Docs\n\n- Orders [Create order](${SITE}/api/prod/orders/new.md)`,
  `## OpenAPI Specification\n\nThe raw OpenAPI specification for this API is available at:\n- [OpenAPI JSON](${SITE}/openapi.json)\n- [OpenAPI YAML](${SITE}/openapi.yaml)\n`,
  `## AsyncAPI Specification\n\nThe raw AsyncAPI 2.6.0 specification for the WebSocket channels is available at:\n- [AsyncAPI JSON](${SITE}/asyncapi.json)\n- [AsyncAPI YAML](${SITE}/asyncapi.yaml)\n`,
);

export const SEARCH_INDEX = {
  version: 1,
  site: SITE,
  pages: [
    { url: '/home', title: 'Zero-fee Trading', kind: 'page', breadcrumbs: [] },
    { url: '/docs/getting-started/what-is-paradex', title: 'What is Paradex?', kind: 'page', breadcrumbs: ['Getting Started'] },
    { url: '/trading/trading-fees', title: 'Trading Fees', kind: 'page', breadcrumbs: ['Trading'] },
    {
      url: '/trading/instruments-guide/futures/tier-1/btc-usd-perp',
      title: 'BTC-USD-PERP',
      kind: 'page',
      breadcrumbs: ['Trading', 'Instruments Guide', 'Futures'],
    },
    { url: '/api/prod/orders/new', title: 'Create order', kind: 'api', breadcrumbs: ['API', 'Orders'] },
    { url: '/api/prod/orders/get-orders', title: 'Get open orders', kind: 'api', breadcrumbs: ['API', 'Orders'] },
    {
      url: '/ws/web-socket-channels/orders-market-symbol/orders-market-symbol',
      title: 'orders.{market_symbol}',
      kind: 'api',
      breadcrumbs: ['WebSocket', 'Channels'],
    },
    { url: '/docs/accounts/sub-accounts', title: 'Sub-Accounts', kind: 'page', breadcrumbs: ['Accounts'] },
    { url: '/api/general-information/rate-limits', title: 'Rate Limits', kind: 'page', breadcrumbs: ['API'] },
    { url: '/releases/changelog/2025/10/16', title: 'October 16, 2025', kind: 'changelog', breadcrumbs: ['Changelog'] },
    { url: '/risk/liquidations', title: 'Liquidations', kind: 'page', breadcrumbs: ['Risk'] },
  ],
  sections: [
    { page: 0, anchor: null, heading: null, text: 'Trade perps, options and spot from one account with zero fees.' },
    { page: 1, anchor: null, heading: null, text: 'Paradex is a zero-fee perpetuals exchange built on its own appchain.' },
    { page: 1, anchor: 'privacy', heading: 'Privacy', text: 'Positions and PnL are private.' },
    { page: 2, anchor: null, heading: null, text: 'Trading fees depend on your order classification. Retail orders pay no fees.' },
    { page: 2, anchor: 'maker-and-taker-fees', heading: 'Maker and taker fees', text: 'Pro traders pay maker and taker fees per fill.' },
    { page: 3, anchor: null, heading: null, text: 'Contract specifications for the BTC-USD-PERP perpetual future.' },
    {
      page: 3,
      anchor: 'contract-specifications',
      heading: 'Contract Specifications',
      text: 'Tick size, minimum order size and funding for BTC-USD-PERP.',
    },
    { page: 4, anchor: null, heading: null, text: 'POST /v1/orders Create order. Open a new order on a market such as ETH-USD-PERP.' },
    {
      page: 4,
      anchor: 'request.body.instruction',
      heading: 'instruction',
      text: 'Order instruction: GTC, POST_ONLY, IOC or RPI. market_symbol must be a valid market.',
    },
    { page: 5, anchor: null, heading: null, text: 'GET /v1/orders Get open orders for the account.' },
    { page: 6, anchor: null, heading: null, text: 'GET /orders.{market_symbol} Private channel with order updates for market_symbol.' },
    { page: 6, anchor: 'receive.subscribe', heading: 'Receive', text: 'Order update messages with status and remaining size.' },
    { page: 7, anchor: null, heading: null, text: 'Sub-accounts let you isolate strategies under one main account.' },
    {
      page: 8,
      anchor: null,
      heading: null,
      text: `Rate limits protect the API. ${'Requests are counted per account and per IP address. '.repeat(12)}Exceeding the rate limit returns HTTP 429 Too Many Requests.`,
    },
    { page: 9, anchor: '2025-10-16-v11169', heading: 'v1.116.9', text: 'Added order book snapshots to the websocket.' },
    { page: 10, anchor: null, heading: null, text: 'Liquidation happens when account value falls below maintenance margin.' },
  ],
};

/** Every file of the fixture site, by path. */
export function siteFiles(overrides = {}) {
  return {
    '/home.md': HOME_MD,
    '/docs/getting-started/what-is-paradex.md': WHAT_IS_MD,
    '/docs/getting-started/what-is-paradex/llms.txt': `${WHAT_IS_MD}\n\n`,
    '/api/prod/orders/new.md': CREATE_ORDER_MD,
    '/api/prod/orders/new/llms.txt': CREATE_ORDER_LLMS,
    '/ws/web-socket-channels/orders-market-symbol/orders-market-symbol.md': WS_ORDERS_MD,
    '/api/general-information/api-quick-start.md': QUICK_START_MD,
    '/docs.md': WHAT_IS_MD,
    '/llms.txt': ROOT_LLMS,
    '/llms-full.txt': '# Paradex | Documentation\n\nEverything.\n',
    '/api/llms.txt': API_SECTION_LLMS,
    '/_mcp/search-index.json': JSON.stringify(SEARCH_INDEX),
    '/index.html': '<!doctype html><title>Home</title>',
    '/docs/getting-started/what-is-paradex.html': '<!doctype html><title>What is Paradex?</title>',
    ...overrides,
  };
}

const TYPES = {
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  html: 'text/html; charset=utf-8',
};

/**
 * A static host over `files`, like Cloudflare's static assets with a
 * 404.html: fetchAsset(path) answers a `redirects` entry ({path: [status,
 * location]}, as a `_redirects` rule would) with that redirect, else the
 * file, else a 404 HTML page. `calls` records requested paths.
 */
export function createSite(overrides = {}, { redirects = {} } = {}) {
  const files = siteFiles(overrides);
  const calls = [];
  const fetchAsset = async (input) => {
    const path = typeof input === 'string' ? input : new URL(input.url ?? input).pathname;
    const pathname = path.split('?')[0];
    calls.push(pathname);
    if (Object.hasOwn(redirects, pathname)) {
      const [status, location] = redirects[pathname];
      return new Response(null, { status, headers: { Location: location } });
    }
    const body = files[pathname];
    if (body === undefined || body === null) {
      return new Response('<!doctype html><title>404</title>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    const ext = pathname.slice(pathname.lastIndexOf('.') + 1);
    return new Response(body, { status: 200, headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' } });
  };
  return { files, calls, fetchAsset };
}

export const MCP_URL = `${SITE}/_mcp/server`;
export const MCP_ACCEPT = 'application/json, text/event-stream';

export function mcpRequest(body, { headers = {}, url = MCP_URL, method = 'POST' } = {}) {
  return new Request(url, {
    method,
    headers: { accept: MCP_ACCEPT, 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

/** Parses an SSE body into its JSON-RPC messages; checks the framing. */
export function parseSse(text) {
  const events = text.split('\n\n').filter((e) => e !== '');
  return events.map((event) => {
    const match = /^event: message\ndata: (.*)$/s.exec(event);
    if (!match) throw new Error(`Bad SSE event: ${JSON.stringify(event)}`);
    return JSON.parse(match[1]);
  });
}
