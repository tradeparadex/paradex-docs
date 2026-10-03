import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { onRequest } from '../functions/_middleware.js';
import { SITE, WHAT_IS_MD, createSite, mcpRequest, parseSse } from './fixtures.mjs';
import worker, { originUrl } from './worker.mjs';

function pagesContext(request, env = {}) {
  const site = createSite();
  const assetUrls = [];
  let nextCalls = 0;
  const context = {
    request,
    env: {
      ...env,
      ASSETS: {
        fetch: (input) => {
          const url = input instanceof URL ? input : new URL(input.url ?? input);
          assetUrls.push(url.href);
          return site.fetchAsset(url.pathname);
        },
      },
    },
    next: () => {
      nextCalls++;
      return new Response('static');
    },
  };
  return { context, assetUrls, nextCalls: () => nextCalls };
}

describe('Cloudflare Pages middleware', () => {
  test('HTML pages and assets go straight to next()', async () => {
    for (const [path, accept] of [
      ['/docs/getting-started/what-is-paradex', 'text/html,*/*;q=0.8'],
      ['/assets/js/main.js', '*/*'],
      ['/robots.txt', 'text/plain'],
    ]) {
      const { context, assetUrls, nextCalls } = pagesContext(new Request(`${SITE}${path}`, { headers: { accept } }));
      const res = await onRequest(context);
      assert.equal(await res.text(), 'static');
      assert.equal(nextCalls(), 1);
      assert.deepEqual(assetUrls, []);
    }
  });

  test('.md requests read the build through env.ASSETS', async () => {
    const { context, assetUrls } = pagesContext(new Request('https://preview.paradex-docs.pages.dev/docs/getting-started/what-is-paradex.md'));
    const res = await onRequest(context);
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(await res.text(), WHAT_IS_MD);
    assert.deepEqual(assetUrls, ['https://preview.paradex-docs.pages.dev/docs/getting-started/what-is-paradex.md']);
  });

  test('a _redirects rule on a .md reaches the client instead of being followed', async () => {
    const seen = [];
    const context = {
      request: new Request(`${SITE}/docs/security.md`),
      env: {
        ASSETS: {
          fetch: async (input) => {
            seen.push(input.redirect);
            return new Response(null, { status: 308, headers: { location: '/chain/security.md' } });
          },
        },
      },
      next: () => new Response('static'),
    };
    const res = await onRequest(context);
    assert.deepEqual(seen, ['manual']);
    assert.equal(res.status, 308);
    assert.equal(res.headers.get('location'), `${SITE}/chain/security.md`);
  });

  test('asset paths stay on the request host', async () => {
    const { context, assetUrls } = pagesContext(new Request(`${SITE}//127.0.0.1:9999/secret.md`));
    await (await onRequest(context)).text();
    assert.ok(assetUrls.length > 0);
    for (const url of assetUrls) assert.equal(new URL(url).origin, SITE, url);
  });

  test('Accept negotiation redirects on the request host', async () => {
    const { context } = pagesContext(new Request('https://preview.paradex-docs.pages.dev/docs', { headers: { accept: 'text/markdown' } }));
    const res = await onRequest(context);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), 'https://preview.paradex-docs.pages.dev/docs.md');
  });

  test('SITE_URL and DOCS_MCP_SERVER come from the environment', async () => {
    let { context } = pagesContext(new Request(`${SITE}/_mcp/server`), { SITE_URL: 'https://docs.example.com' });
    const descriptor = await (await onRequest(context)).json();
    assert.equal(descriptor.usage.cursor, 'Add "https://docs.example.com/_mcp/server" to your MCP server configuration');
    ({ context } = pagesContext(new Request(`${SITE}/_mcp/server`), { DOCS_MCP_SERVER: 'off' }));
    assert.equal((await onRequest(context)).status, 404);
  });

  test('the MCP server searches the deployed index', async () => {
    const { context } = pagesContext(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'searchDocs', arguments: { query: 'trading fees', topK: 1 } } }));
    const [message] = parseSse(await (await onRequest(context)).text());
    assert.equal(message.result.structuredContent.results[0].url, `${SITE}/trading/trading-fees`);
  });
});

describe('standalone Worker', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function stubOrigin() {
    const site = createSite();
    const seen = [];
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      seen.push({ url: request.url, method: request.method, body: request.body ? await request.text() : null, init });
      const url = new URL(request.url);
      const file = url.pathname.replace(/^\/paradex-docs/, '');
      if (site.files[file] !== undefined) return site.fetchAsset(file);
      return new Response(`origin ${url.pathname}`, { headers: { 'content-type': 'text/html' } });
    };
    return seen;
  }

  test('maps paths onto ORIGIN, keeping its path prefix', () => {
    const origin = 'https://tradeparadex.github.io/paradex-docs/';
    assert.equal(originUrl('/docs.md', `${SITE}/x`, origin).href, 'https://tradeparadex.github.io/paradex-docs/docs.md');
    assert.equal(originUrl(`${SITE}/a?b=1`, `${SITE}/x`, origin).href, 'https://tradeparadex.github.io/paradex-docs/a?b=1');
    assert.equal(originUrl('/docs.md', `${SITE}/x`, null).href, `${SITE}/docs.md`);
  });

  test('a path can never name another host', () => {
    for (const origin of [null, 'https://paradex-docs.pages.dev', 'https://tradeparadex.github.io/paradex-docs']) {
      const expected = origin ? new URL(origin).origin : SITE;
      for (const input of ['//evil.example/secret.md', '/\\evil.example/secret.md', '///evil.example/x', `${SITE}//evil.example/x?y=1`]) {
        const url = originUrl(input, `${SITE}/x`, origin);
        assert.equal(url.origin, expected, `${input} via ${origin}`);
        assert.ok(!url.pathname.includes('//'), url.href);
      }
    }
    assert.equal(originUrl(`${SITE}//evil.example/x?y=1`, `${SITE}/x`, 'https://paradex-docs.pages.dev').href, 'https://paradex-docs.pages.dev/evil.example/x?y=1');
  });

  test('raw "//host" request paths and fetchPage dot segments only ever fetch the origin (SSRF)', async () => {
    const seen = stubOrigin();
    for (const env of [{}, { ORIGIN: 'https://paradex-docs.pages.dev' }, { ORIGIN: 'https://tradeparadex.github.io/paradex-docs' }]) {
      seen.length = 0;
      for (const path of ['//127.0.0.1:9999/secret.md', '//127.0.0.1:9999/llms.txt', '/\\127.0.0.1:9999/secret.md', '//127.0.0.1:9999/anything?x=1']) {
        await (await worker.fetch(new Request(`${SITE}${path}`), env)).text();
      }
      for (const path of ['/.//127.0.0.1:9999/secret', '/a/..//127.0.0.1:9999/secret', '/%2e//127.0.0.1:9999/secret']) {
        const res = await worker.fetch(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path } } }), env);
        const [message] = parseSse(await res.text());
        assert.match(message.result.content[0].text, /^# Page Not Found/, path);
      }
      const expected = env.ORIGIN ? new URL(env.ORIGIN).origin : SITE;
      assert.ok(seen.length >= 7);
      for (const { url } of seen) assert.equal(new URL(url).origin, expected, url);
    }
  });

  test('serves .md from ORIGIN with Fern headers', async () => {
    const seen = stubOrigin();
    const env = { ORIGIN: 'https://tradeparadex.github.io/paradex-docs' };
    const res = await worker.fetch(new Request(`${SITE}/docs/getting-started/what-is-paradex.md?x=1`), env);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    assert.equal(await res.text(), WHAT_IS_MD);
    assert.equal(seen[0].url, 'https://tradeparadex.github.io/paradex-docs/docs/getting-started/what-is-paradex.md');
    assert.deepEqual(seen[0].init.cf, { cacheEverything: true, cacheTtl: 300 });
  });

  test('proxies everything else to ORIGIN unchanged', async () => {
    const seen = stubOrigin();
    const env = { ORIGIN: 'https://tradeparadex.github.io/paradex-docs' };
    const res = await worker.fetch(new Request(`${SITE}/docs/page?q=1`, { headers: { accept: 'text/html' } }), env);
    assert.equal(await res.text(), 'origin /paradex-docs/docs/page');
    assert.equal(seen[0].url, 'https://tradeparadex.github.io/paradex-docs/docs/page?q=1');
    await worker.fetch(new Request(`${SITE}/form`, { method: 'POST', body: 'payload' }), env);
    assert.equal(seen[1].method, 'POST');
    assert.equal(seen[1].body, 'payload');
  });

  test('without ORIGIN the request goes to the zone\'s own origin', async () => {
    const seen = stubOrigin();
    const res = await worker.fetch(new Request(`${SITE}/docs/page`));
    assert.equal(await res.text(), 'origin /docs/page');
    assert.equal(seen[0].url, `${SITE}/docs/page`);
  });

  test('answers MCP requests itself', async () => {
    stubOrigin();
    const env = { ORIGIN: 'https://tradeparadex.github.io/paradex-docs' };
    const res = await worker.fetch(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path: '/docs' } } }), env);
    const [message] = parseSse(await res.text());
    assert.deepEqual(message.result.structuredContent, { url: `${SITE}/docs` });
  });
});
