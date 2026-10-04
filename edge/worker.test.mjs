import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SITE, WHAT_IS_MD, createSite, mcpRequest, parseSse } from './fixtures.mjs';
import worker from './worker.mjs';

/** The Worker with an env.ASSETS binding over the fixture site. */
function deploy(env = {}) {
  const site = createSite();
  const assetRequests = [];
  const passedThrough = [];
  const ASSETS = {
    fetch: (input) => {
      const request = input instanceof Request ? input : new Request(input);
      assetRequests.push(request);
      return site.fetchAsset(new URL(request.url).pathname);
    },
  };
  return {
    fetch: (request) =>
      worker.fetch(request, {
        ...env,
        ASSETS: {
          fetch: (input) => {
            // The request itself: a pass-through to the static assets.
            if (input === request) {
              passedThrough.push(input);
              return new Response('static');
            }
            return ASSETS.fetch(input);
          },
        },
      }),
    assetUrls: () => assetRequests.map((r) => r.url),
    assetRequests,
    passedThrough,
  };
}

describe('Cloudflare Worker (static assets)', () => {
  test('HTML pages and other files go straight to the assets, untouched', async () => {
    for (const [path, accept, method] of [
      ['/docs/getting-started/what-is-paradex', 'text/html,*/*;q=0.8', 'GET'],
      ['/docs/getting-started/what-is-paradex/', 'text/html', 'GET'],
      ['/robots.txt', 'text/plain', 'GET'],
      ['/sitemap.xml', '*/*', 'HEAD'],
      ['/form', '*/*', 'POST'],
    ]) {
      const w = deploy();
      const request = new Request(`${SITE}${path}`, { method, headers: { accept }, body: method === 'POST' ? 'payload' : undefined });
      const res = await w.fetch(request);
      assert.equal(await res.text(), 'static', path);
      assert.deepEqual(w.passedThrough, [request], path);
      assert.deepEqual(w.assetUrls(), [], path);
    }
  });

  test('.md requests read the build through env.ASSETS on the request host', async () => {
    const w = deploy();
    const res = await w.fetch(new Request('https://pr-1-paradex-docs.example.workers.dev/docs/getting-started/what-is-paradex.md?x=1'));
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.equal(await res.text(), WHAT_IS_MD);
    assert.deepEqual(w.assetUrls(), ['https://pr-1-paradex-docs.example.workers.dev/docs/getting-started/what-is-paradex.md']);
  });

  test('a _redirects rule on a .md reaches the client instead of being followed', async () => {
    const seen = [];
    const env = {
      ASSETS: {
        fetch: async (input) => {
          seen.push(input.redirect);
          return new Response(null, { status: 308, headers: { location: '/chain/security.md' } });
        },
      },
    };
    const res = await worker.fetch(new Request(`${SITE}/docs/security.md`), env);
    assert.deepEqual(seen, ['manual']);
    assert.equal(res.status, 308);
    assert.equal(res.headers.get('location'), `${SITE}/chain/security.md`);
  });

  test('raw "//host" request paths and fetchPage dot segments only ever read the build (SSRF)', async () => {
    const w = deploy();
    for (const path of ['//127.0.0.1:9999/secret.md', '//127.0.0.1:9999/llms.txt', '/\\127.0.0.1:9999/secret.md', '//127.0.0.1:9999/x/.well-known/api-catalog']) {
      await (await w.fetch(new Request(`${SITE}${path}`))).text();
    }
    for (const path of ['/.//127.0.0.1:9999/secret', '/a/..//127.0.0.1:9999/secret', '/%2e//127.0.0.1:9999/secret']) {
      const res = await w.fetch(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path } } }));
      const [message] = parseSse(await res.text());
      assert.match(message.result.content[0].text, /^# Page Not Found/, path);
    }
    assert.ok(w.assetRequests.length >= 7);
    for (const request of w.assetRequests) {
      const url = new URL(request.url);
      assert.equal(url.origin, SITE, request.url);
      assert.ok(!url.pathname.startsWith('//'), request.url);
      assert.equal(url.search, '', request.url);
    }
  });

  test('Accept negotiation redirects on the request host', async () => {
    const w = deploy();
    const res = await w.fetch(new Request('https://pr-1-paradex-docs.example.workers.dev/docs?x=1', { headers: { accept: 'text/markdown' } }));
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), 'https://pr-1-paradex-docs.example.workers.dev/docs.md?x=1');
    assert.deepEqual(w.passedThrough, []);
  });

  test('SITE_URL and DOCS_MCP_SERVER come from the environment', async () => {
    const descriptor = await (await deploy({ SITE_URL: 'https://docs.example.com' }).fetch(new Request(`${SITE}/_mcp/server`))).json();
    assert.equal(descriptor.usage.cursor, 'Add "https://docs.example.com/_mcp/server" to your MCP server configuration');
    assert.equal((await deploy({ DOCS_MCP_SERVER: 'off' }).fetch(new Request(`${SITE}/_mcp/server`))).status, 404);
  });

  test('the MCP server searches the deployed index', async () => {
    const w = deploy();
    const res = await w.fetch(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'searchDocs', arguments: { query: 'trading fees', topK: 1 } } }));
    const [message] = parseSse(await res.text());
    assert.equal(message.result.structuredContent.results[0].url, `${SITE}/trading/trading-fees`);
  });
});
