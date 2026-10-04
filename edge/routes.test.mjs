import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { createEdge, isNegotiablePath, markdownAssetPath, needsEdge } from './core.mjs';
import {
  API_SECTION_LLMS,
  CREATE_ORDER_LLMS,
  CREATE_ORDER_MD,
  HOME_MD,
  PREAMBLE,
  QUICK_START_MD,
  ROOT_LLMS,
  SITE,
  WHAT_IS_MD,
  WS_ORDERS_MD,
  createSite,
} from './fixtures.mjs';
import { filterAgentMarkdown, notFoundBody, parseSdkLanguageFilter, routeScore, suggestRoutes } from './markdown.mjs';

const MD_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  'x-robots-tag': 'noindex',
  'cache-control': 'public, max-age=300, s-maxage=31536000, stale-while-revalidate=31536000',
};

let site;
let edge;
let passed;

beforeEach(() => {
  site = createSite();
  edge = createEdge();
  passed = new Response('from next()');
});

function get(path, { accept, method = 'GET', options = {} } = {}) {
  const headers = accept ? { accept } : {};
  return edge.handle(new Request(`${SITE}${path}`, { method, headers }), {
    fetchAsset: site.fetchAsset,
    next: () => passed,
    ...options,
  });
}

function assertHeaders(res, expected) {
  for (const [name, value] of Object.entries(expected)) assert.equal(res.headers.get(name), value, name);
}

const fence = (info, ...code) => ['```' + info, ...code, '```'].join('\n');
const doc = (...blocks) => blocks.join('\n\n');

describe('Accept negotiation', () => {
  test('a page requested as text/markdown or text/plain gets a 303 to its .md', async () => {
    for (const accept of ['text/markdown', 'text/plain', 'text/html, text/markdown;q=0.1', 'text/plain;q=0']) {
      const res = await get('/docs/getting-started/what-is-paradex', { accept });
      assert.equal(res.status, 303, accept);
      assert.equal(res.headers.get('location'), `${SITE}/docs/getting-started/what-is-paradex.md`);
      assert.equal(res.headers.get('vary'), null);
      assert.equal(res.body, null);
    }
  });

  test('keeps the query string; "/" goes to "/.md"; trailing slashes are dropped', async () => {
    assert.equal((await get('/api/prod/orders/new?lang=python', { accept: 'text/markdown' })).headers.get('location'), `${SITE}/api/prod/orders/new.md?lang=python`);
    assert.equal((await get('/', { accept: 'text/markdown' })).headers.get('location'), `${SITE}/.md`);
    assert.equal((await get('/docs/', { accept: 'text/markdown' })).headers.get('location'), `${SITE}/docs.md`);
  });

  test('applies to GET, HEAD and OPTIONS only', async () => {
    assert.equal((await get('/docs', { accept: 'text/markdown', method: 'HEAD' })).status, 303);
    assert.equal((await get('/docs', { accept: 'text/markdown', method: 'OPTIONS' })).status, 303);
    assert.equal(await get('/docs', { accept: 'text/markdown', method: 'POST' }), passed);
  });

  test('browsers and other clients get the page', async () => {
    const browser = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    for (const accept of [browser, '*/*', 'application/json', undefined]) {
      assert.equal(await get('/docs/getting-started/what-is-paradex', { accept }), passed);
    }
  });

  test('never redirects llms files, Markdown, well-known, MCP, feeds or files', async () => {
    const excluded = [
      '/llms.txt',
      '/docs/llms.txt',
      '/llms-full.txt',
      '/robots.txt',
      '/sitemap.xml',
      '/sitemap-0.xml',
      '/favicon.ico',
      '/.well-known/security.txt',
      '/.well-known/skills/index',
      '/openapi.json',
      '/openapi.yaml',
      '/asyncapi.json',
      '/openapi/rest-endpoints.yaml',
      '/_mcp/search-index.json',
      '/_mcp/other',
      '/mcp',
      '/releases/changelog/rss.xml',
      '/releases/changelog/atom.xml',
      '/releases/changelog/feed.json',
      '/releases/changelog.rss',
      '/assets/js/main.4f3a.js',
      '/docs/getting-started/what-is-paradex.html',
      '/context7.json',
    ];
    for (const path of excluded) assert.equal(isNegotiablePath(path), false, path);
    for (const path of ['/', '/docs', '/docs/getting-started/what-is-paradex', '/releases/changelog/2025/10/16', '/ws/web-socket-channels/orders-market-symbol/orders-market-symbol']) {
      assert.equal(isNegotiablePath(path), true, path);
    }
    assert.equal(await get('/assets/img/logo.svg', { accept: 'text/plain' }), passed);
    assert.equal(await get('/mcp', { accept: 'text/plain' }), passed);
  });
});

describe('.md and .mdx', () => {
  test('serves the page Markdown with Fern\'s headers', async () => {
    const res = await get('/docs/getting-started/what-is-paradex.md');
    assert.equal(res.status, 200);
    assertHeaders(res, MD_HEADERS);
    assert.equal(res.headers.get('vary'), null);
    assert.equal(await res.text(), WHAT_IS_MD);
  });

  test('the Content-Type does not depend on Accept', async () => {
    const res = await get('/docs/getting-started/what-is-paradex.md', { accept: 'text/html' });
    assertHeaders(res, MD_HEADERS);
  });

  test('/.md is the home page; .mdx is the same as .md', async () => {
    assert.equal(await (await get('/.md')).text(), HOME_MD);
    assert.equal(await (await get('/.mdx')).text(), HOME_MD);
    const mdx = await get('/docs/getting-started/what-is-paradex.mdx');
    assertHeaders(mdx, MD_HEADERS);
    assert.equal(await mdx.text(), WHAT_IS_MD);
    assert.equal(await (await get('/docs/.md')).text(), WHAT_IS_MD);
    assert.deepEqual(markdownAssetPath('/.md'), { assetPath: '/home.md', slug: 'home' });
    assert.deepEqual(markdownAssetPath('/a/b.mdx'), { assetPath: '/a/b.md', slug: 'a/b' });
    // Repeated slashes collapse, so the asset path never starts with "//".
    assert.deepEqual(markdownAssetPath('//127.0.0.1:9999/secret.md'), { assetPath: '/127.0.0.1:9999/secret.md', slug: '127.0.0.1:9999/secret' });
    assert.deepEqual(markdownAssetPath('/a//b///.md'), { assetPath: '/a/b.md', slug: 'a/b' });
  });

  test('HEAD has the headers and no body; OPTIONS lists OPTIONS, GET', async () => {
    const head = await get('/docs/getting-started/what-is-paradex.md', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assertHeaders(head, MD_HEADERS);
    assert.equal(head.body, null);
    const options = await get('/docs/getting-started/what-is-paradex.md', { method: 'OPTIONS' });
    assert.equal(options.status, 200);
    assertHeaders(options, { allow: 'OPTIONS, GET', 'x-robots-tag': 'noindex' });
    assert.equal(options.body, null);
    const post = await get('/docs/getting-started/what-is-paradex.md', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD, OPTIONS');
  });

  test('a missing page gets the agent not-found with similar pages', async () => {
    const res = await get('/docs/getting-started/what-is-paradx.md');
    assert.equal(res.status, 200);
    assertHeaders(res, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
    assert.equal(
      await res.text(),
      [
        '# Page Not Found',
        '',
        'This page does not exist.',
        '',
        '## Similar pages',
        '',
        `- [What is Paradex?](${SITE}/docs/getting-started/what-is-paradex.md)`,
        `- [Sub-Accounts](${SITE}/docs/accounts/sub-accounts.md)`,
        `- [BTC-USD-PERP](${SITE}/trading/instruments-guide/futures/tier-1/btc-usd-perp.md)`,
        '',
      ].join('\n'),
    );
  });

  test('without a search index the not-found has no suggestions', async () => {
    site = createSite({ '/_mcp/search-index.json': null });
    const res = await get('/nope.md');
    assert.equal(await res.text(), '# Page Not Found\n\nThis page does not exist.\n');
  });

  test('a host error is passed through', async () => {
    const res = await edge.handle(new Request(`${SITE}/x.md`), { fetchAsset: async () => new Response('down', { status: 503 }) });
    assert.equal(res.status, 503);
  });
});

describe('.md of redirected URLs', () => {
  test('a redirect Cloudflare answers from _redirects reaches the client as Fern\'s 308/307', async () => {
    const cases = [
      [301, '/chain/security.md', 308],
      [308, '/chain/security.md', 308],
      [302, '/chain/security.md', 307],
      [307, '/chain/security.md', 307],
    ];
    for (const [hostStatus, location, status] of cases) {
      const fetchAsset = async () => new Response(null, { status: hostStatus, headers: { location } });
      const res = await edge.handle(new Request(`${SITE}/docs/security.md?lang=python`), { fetchAsset });
      assert.equal(res.status, status, String(hostStatus));
      assert.equal(res.headers.get('location'), `${SITE}/chain/security.md?lang=python`);
      assert.equal(res.headers.get('x-robots-tag'), 'noindex');
      assert.equal(res.body, null);
    }
  });

  test('a redirect keeps its #hash and an explicit query', async () => {
    site = createSite({}, { redirects: { '/staking.md': [308, '/trading/trading-fees.md?x=1#stake-dime'] } });
    const res = await get('/staking.md?lang=python');
    assert.equal(res.status, 308);
    assert.equal(res.headers.get('location'), `${SITE}/trading/trading-fees.md?x=1#stake-dime`);
  });
});

describe('?lang= and ?excludeSpec=', () => {
  const ENDPOINT_HEAD = doc(
    PREAMBLE,
    '# Create order',
    'POST https://api.prod.paradex.trade/v1/orders\nContent-Type: application/json',
    'Open a new order.',
    `Reference: ${SITE}/api/prod/orders/new`,
  );
  const EXAMPLES = doc('## Examples', '**Request**', fence('json', '{', '  "market": "BTC-USD-PERP"', '}'), '**Response**', fence('json', '{', '  "id": "123"', '}'));

  test('excludeSpec=true drops the schema sections of an endpoint page', async () => {
    const res = await get('/api/prod/orders/new.md?excludeSpec=true');
    assertHeaders(res, MD_HEADERS);
    assert.equal(
      await res.text(),
      doc(
        ENDPOINT_HEAD,
        EXAMPLES,
        '**Code Samples**',
        fence('python', 'import requests'),
        fence('curl', 'curl -X POST https://api.prod.paradex.trade/v1/orders'),
        fence('javascript', 'fetch("https://api.prod.paradex.trade/v1/orders")'),
        fence('go', 'http.Post("https://api.prod.paradex.trade/v1/orders")'),
        '**SDK Code**',
        fence('python Create order', 'client.create_order()'),
        fence('typescript Create order', 'await client.createOrder()'),
      ),
    );
  });

  test('excludeSpec=true drops a WebSocket page\'s AsyncAPI block', async () => {
    const res = await get('/ws/web-socket-channels/orders-market-symbol/orders-market-symbol.md?excludeSpec=true');
    assert.equal(
      await res.text(),
      doc(
        PREAMBLE,
        '# orders.{market_symbol}',
        'GET /orders.{market_symbol}',
        'Private channel with order updates.',
        `Reference: ${SITE}/ws/web-socket-channels/orders-market-symbol/orders-market-symbol`,
      ),
    );
  });

  test('lang keeps the matching code samples and SDK snippets', async () => {
    const python = await (await get('/api/prod/orders/new.md?lang=py')).text();
    assert.ok(python.endsWith(doc('**Code Samples**', fence('python', 'import requests'), '**SDK Code**', fence('python Create order', 'client.create_order()'))));
    assert.ok(python.includes('## Authentication'));
    const node = await (await get('/api/prod/orders/new.md?lang=TypeScript')).text();
    assert.ok(
      node.endsWith(
        doc('**Code Samples**', fence('javascript', 'fetch("https://api.prod.paradex.trade/v1/orders")'), '**SDK Code**', fence('typescript Create order', 'await client.createOrder()')),
      ),
    );
    // No SDK snippet for Go: the label goes too.
    const go = await (await get('/api/prod/orders/new.md?lang=golang&excludeSpec=true')).text();
    assert.equal(go, doc(ENDPOINT_HEAD, EXAMPLES, '**Code Samples**', fence('go', 'http.Post("https://api.prod.paradex.trade/v1/orders")')));
    // Nothing for Ruby: curl is not kept either (Fern filters user samples too).
    const ruby = await (await get('/api/prod/orders/new.md?lang=ruby&excludeSpec=true')).text();
    assert.equal(ruby, doc(ENDPOINT_HEAD, EXAMPLES));
  });

  test('unknown values apply no filter', async () => {
    for (const query of ['lang=cobol', 'excludeSpec=TRUE', 'excludeSpec=1', 'lang=']) {
      assert.equal(await (await get(`/api/prod/orders/new.md?${query}`)).text(), CREATE_ORDER_MD, query);
    }
    assert.equal(parseSdkLanguageFilter('JS'), 'node');
    assert.equal(parseSdkLanguageFilter('golang'), 'go');
    assert.equal(parseSdkLanguageFilter('kotlin'), undefined);
    assert.equal(parseSdkLanguageFilter(null), undefined);
  });

  test('lang filters an endpoint request snippet but always keeps curl', async () => {
    const text = await (await get('/api/general-information/api-quick-start.md?lang=python')).text();
    assert.equal(text, QUICK_START_MD.replace(`\n\n${fence('javascript', 'fetch("https://api.prod.paradex.trade/v1/markets")')}`, ''));
    const ruby = await (await get('/api/general-information/api-quick-start.md?lang=ruby')).text();
    assert.ok(ruby.includes(fence('curl', 'curl https://api.prod.paradex.trade/v1/markets')));
    assert.ok(!ruby.includes('```python'));
    // excludeSpec does not touch docs pages ("### Request" here is not a schema section).
    assert.equal(await (await get('/api/general-information/api-quick-start.md?excludeSpec=true')).text(), QUICK_START_MD);
  });

  test('a page-level llms.txt keeps its closing "> subtitle"', async () => {
    const res = await get('/api/prod/orders/new/llms.txt?excludeSpec=true');
    const text = await res.text();
    assert.ok(text.startsWith(ENDPOINT_HEAD));
    assert.ok(text.endsWith('\n\n> Open a new order.\n\n'));
    assert.ok(!text.includes('## Types'));
    // Without an Examples section the schema runs to the subtitle.
    const noExamples = `${doc(ENDPOINT_HEAD, '## Response', '### 200', '- `id` (string, optional) — Order id')}\n\n> Open a new order.\n\n`;
    assert.equal(filterAgentMarkdown(noExamples, { excludeSpec: true }), `${ENDPOINT_HEAD}\n\n> Open a new order.\n\n`);
    assert.equal(CREATE_ORDER_LLMS.startsWith(CREATE_ORDER_MD), true);
  });

  test('excludeSpec drops everything from the first schema heading to ## Examples', () => {
    const text = doc(ENDPOINT_HEAD, '## Request', '### Query parameters', '- `a` (string, optional)', '## Webhook payload', 'x', '## Examples', '**Request**');
    assert.equal(filterAgentMarkdown(text, { excludeSpec: true }), doc(ENDPOINT_HEAD, '## Examples', '**Request**'));
    // A description's own headings come before "Reference:" and stay.
    const described = doc('# T', 'GET https://x.example/a', '## Notes', 'text', `Reference: ${SITE}/a`, '## Response', '### 200');
    assert.equal(filterAgentMarkdown(described, { excludeSpec: true }), doc('# T', 'GET https://x.example/a', '## Notes', 'text', `Reference: ${SITE}/a`));
  });

  test('section llms.txt link lists are not filtered', async () => {
    const res = await get('/api/llms.txt?excludeSpec=true&lang=python');
    assert.equal(await res.text(), API_SECTION_LLMS);
  });

  test('fences that contain heading-like lines are left alone', () => {
    const text = doc(`Reference: ${SITE}/x`, '## Examples', fence('text', '## Types', 'not a section'), '**Code Samples**', '````md', '```python', 'x', '```', '````');
    assert.equal(filterAgentMarkdown(text, { excludeSpec: true }), text);
    assert.equal(filterAgentMarkdown(text, { sdkLanguage: 'python' }), doc(`Reference: ${SITE}/x`, '## Examples', fence('text', '## Types', 'not a section')));
  });
});

describe('llms.txt and llms-full.txt', () => {
  const CACHE = 'public, max-age=300, s-maxage=31536000, stale-while-revalidate=31536000';

  test('Content-Type follows Accept; Vary and cache headers; no X-Robots-Tag', async () => {
    const cases = [
      [undefined, 'text/plain; charset=utf-8'],
      ['text/plain', 'text/plain; charset=utf-8'],
      ['text/markdown', 'text/markdown; charset=utf-8'],
      ['text/plain, text/markdown', 'text/markdown; charset=utf-8'],
    ];
    for (const [accept, type] of cases) {
      const res = await get('/llms.txt', { accept });
      assert.equal(res.status, 200);
      assertHeaders(res, { 'content-type': type, vary: 'Accept', 'cache-control': CACHE, 'x-robots-tag': null });
      assert.equal(await res.text(), ROOT_LLMS);
    }
  });

  test('section and page llms.txt are served the same way', async () => {
    const res = await get('/docs/getting-started/what-is-paradex/llms.txt', { accept: 'text/markdown' });
    assertHeaders(res, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' });
    assert.equal(await res.text(), `${WHAT_IS_MD}\n\n`);
  });

  test('a missing llms.txt is the agent not-found without suggestions', async () => {
    const res = await get('/docs/getting-started/what-is-paradx/llms.txt');
    assert.equal(res.status, 200);
    assertHeaders(res, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
    assert.equal(await res.text(), '# Page Not Found\n\nThis page does not exist.\n');
  });

  test('HEAD, OPTIONS and other methods', async () => {
    const head = await get('/llms.txt', { method: 'HEAD', accept: 'text/markdown' });
    assertHeaders(head, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' });
    assert.equal(head.body, null);
    const options = await get('/llms.txt', { method: 'OPTIONS' });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('allow'), 'GET, HEAD, OPTIONS');
    assert.equal((await get('/llms.txt', { method: 'DELETE' })).status, 405);
  });

  test('the root llms-full.txt is served; a missing section one redirects to its llms.txt', async () => {
    const full = await get('/llms-full.txt');
    assertHeaders(full, { 'content-type': 'text/plain; charset=utf-8', vary: 'Accept', 'cache-control': CACHE });
    assert.equal(await full.text(), '# Paradex | Documentation\n\nEverything.\n');
    const section = await get('/api/llms-full.txt?lang=python');
    assert.equal(section.status, 301);
    assert.equal(section.headers.get('location'), `${SITE}/api/llms.txt`);
  });
});

describe('/.well-known/api-catalog', () => {
  const HEADERS = {
    'content-type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    link: `<${SITE}/.well-known/api-catalog>; rel="api-catalog"`,
    'cache-control': 'public, s-maxage=31536000, stale-while-revalidate=31536000',
  };

  test('serves the build\'s file with RFC 9727 headers', async () => {
    site = createSite({ '/.well-known/api-catalog': '{"linkset":[]}' });
    const res = await get('/.well-known/api-catalog');
    assert.equal(res.status, 200);
    assertHeaders(res, HEADERS);
    assert.equal(await res.text(), '{"linkset":[]}');
  });

  test('falls back to a generated linkset', async () => {
    const res = await get('/.well-known/api-catalog', { accept: 'text/plain' });
    assertHeaders(res, HEADERS);
    assert.deepEqual(await res.json(), {
      linkset: [
        {
          anchor: `${SITE}/api/prod`,
          'service-desc': [{ href: `${SITE}/openapi/rest-endpoints.yaml`, type: 'application/yaml' }],
          'service-doc': [{ href: `${SITE}/api/prod`, type: 'text/html' }],
        },
        {
          anchor: `${SITE}/api/testnet`,
          'service-desc': [{ href: `${SITE}/openapi/rest-endpoints-2.yaml`, type: 'application/yaml' }],
          'service-doc': [{ href: `${SITE}/api/testnet`, type: 'text/html' }],
        },
      ],
    });
  });

  test('HEAD has the same headers and no body', async () => {
    const res = await get('/.well-known/api-catalog', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assertHeaders(res, HEADERS);
    assert.equal(res.body, null);
    assert.equal((await get('/.well-known/api-catalog', { method: 'POST' })).status, 405);
  });
});

describe('pass-through', () => {
  test('everything else is next()\'s response, untouched', async () => {
    for (const path of ['/', '/docs/getting-started/what-is-paradex', '/assets/js/main.js', '/_mcp/search-index.json', '/robots.txt']) {
      assert.equal(await get(path), passed, path);
    }
  });

  test('without next() the request goes to fetchAsset', async () => {
    const request = new Request(`${SITE}/index.html`);
    let seen;
    const res = await edge.handle(request, {
      fetchAsset: (input) => {
        seen = input;
        return new Response('asset');
      },
    });
    assert.equal(seen, request);
    assert.equal(await res.text(), 'asset');
  });

  test('needsEdge() is false exactly when handle() would pass through', () => {
    const req = (path, init = {}) => new Request(`${SITE}${path}`, init);
    const yes = [
      req('/_mcp/server'),
      req('/_mcp/server/', { method: 'POST', body: '{}' }),
      req('/mcp', { method: 'POST', body: '{}' }),
      req('/docs.md'),
      req('/docs.mdx'),
      req('/llms.txt'),
      req('/api/llms-full.txt'),
      req('/.well-known/api-catalog'),
      req('/docs', { headers: { accept: 'text/markdown' } }),
    ];
    const no = [
      req('/docs'),
      req('/docs', { headers: { accept: 'text/html' } }),
      req('/docs', { method: 'POST', headers: { accept: 'text/markdown' }, body: '' }),
      req('/assets/js/main.js', { headers: { accept: 'text/plain' } }),
      req('/robots.txt', { headers: { accept: 'text/plain' } }),
    ];
    for (const r of yes) assert.equal(needsEdge(r), true, r.url);
    for (const r of no) assert.equal(needsEdge(r), false, r.url);
  });
});

describe('not-found suggestions', () => {
  test('stay fast on hostile slugs (long slash runs, long paths)', () => {
    const pages = Array.from({ length: 700 }, (_, i) => ({ url: `/docs/section-${i}/page-${i}`, title: `Page ${i}` }));
    for (const slug of [`a${'/'.repeat(8000)}b`, 'x'.repeat(30000), 'ab/'.repeat(1000), `${'/'.repeat(5000)}docs`]) {
      const started = performance.now();
      const suggestions = suggestRoutes(slug, pages);
      assert.ok(performance.now() - started < 200, `${slug.length} chars took ${performance.now() - started} ms`);
      // Leading/trailing slashes are trimmed (Fern); only an overlong slug gets none.
      assert.equal(suggestions.length, slug.endsWith('docs') ? 3 : 0, slug.slice(0, 20));
    }
    assert.ok(suggestRoutes('docs/section-3/page-3x', pages).length === 3);
  });

  test('a .md URL with thousands of slashes answers quickly', async () => {
    const started = performance.now();
    const res = await edge.handle(new Request(`${SITE}/a${'/'.repeat(8000)}b.md`), { fetchAsset: site.fetchAsset });
    assert.match(await res.text(), /^# Page Not Found/);
    assert.ok(performance.now() - started < 500, `${performance.now() - started} ms`);
  });

  test('use Fern\'s scoring formula', () => {
    // levenshtein 2 of 8 -> 0.75 * 0.5; 2 of 3 segments shared -> 0.3 * 2/3; containment -> 0.2 * 0.3
    assert.ok(Math.abs(routeScore('/docs/a', 'docs/a/b') - (0.375 + 0.2 + 0.06)) < 1e-12);
    assert.equal(routeScore('/Docs/A/', 'docs/a'), 1);
    assert.equal(routeScore('xyz', 'abc'), 0);
  });

  test('return the top 3 unique pages and nothing for the root', () => {
    const pages = [
      { url: '/a/b', title: 'AB' },
      { url: '/a/b', title: 'AB again' },
      { url: '/a/c', title: 'AC' },
      { url: '/x/y', title: 'XY' },
      { url: '/a', title: 'A' },
    ];
    // a/b: 0.375 + 0.15 + 0.06 = 0.585; a/c: 0.25 + 0.15 = 0.4; a: 0.125 + 0.15 + 0.06 = 0.335
    assert.deepEqual(suggestRoutes('a/bb', pages), [
      { title: 'AB', href: '/a/b' },
      { title: 'AC', href: '/a/c' },
      { title: 'A', href: '/a' },
    ]);
    assert.deepEqual(suggestRoutes('', pages), []);
    assert.deepEqual(suggestRoutes('/', pages), []);
    assert.deepEqual(suggestRoutes('a/'.repeat(200), pages), []);
    assert.equal(notFoundBody(SITE, [{ title: 'A', href: '/a' }]), `# Page Not Found\n\nThis page does not exist.\n\n## Similar pages\n\n- [A](${SITE}/a.md)\n`);
  });
});
