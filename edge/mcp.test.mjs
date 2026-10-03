import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createEdge } from './core.mjs';
import { CREATE_ORDER_MD, HOME_MD, MCP_URL, SITE, WHAT_IS_MD, createSite, mcpRequest, parseSse } from './fixtures.mjs';
import { mcpDescriptor, mcpServerName, resolveDocsPath, toolList } from './mcp.mjs';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];
const UNSUPPORTED = (v) =>
  `Bad Request: Unsupported protocol version: ${v} (supported versions: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07)`;

let site;
let edge;
let realFetch;

beforeEach(() => {
  site = createSite();
  edge = createEdge();
  // The MCP server must never reach the network: everything goes through fetchAsset.
  realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('unexpected network fetch');
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function send(request, options = {}) {
  return edge.handle(request, { fetchAsset: site.fetchAsset, ...options });
}

async function rpc(body, headers) {
  const res = await send(mcpRequest(body, { headers }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  return parseSse(await res.text());
}

async function call(name, args) {
  const [message] = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  assert.equal(message.id, 1);
  return message.result;
}

async function expectJsonError(res, status, code, message) {
  assert.equal(res.status, status);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(await res.text(), JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

const DESCRIPTOR_JSON =
  '{"name":"fern-docs-mcp-server","version":"1.0.0","description":"MCP server for https://docs.paradex.trade documentation. Provides AI-powered search over the documentation.","transport":"streamable-http","tools":[' +
  '{"name":"searchDocs","description":"Search the documentation at https://docs.paradex.trade. Returns ranked results with title, url, section anchor and a snippet, in rank order. Use fetchPage to read a result in full.","annotations":{"title":"Search docs.paradex.trade Docs","readOnlyHint":true},"inputSchema":{"type":"object","properties":{"query":{"type":"string","description":"The search query to run against the docs"},"topK":{"type":"integer","description":"How many results to return (default 8, max 20)"}},"required":["query"]}},' +
  '{"name":"fetchPage","description":"Read one page of the documentation at https://docs.paradex.trade as markdown. Takes a path or url from a searchDocs result.","annotations":{"title":"Fetch a docs.paradex.trade Docs page","readOnlyHint":true},"inputSchema":{"type":"object","properties":{"path":{"type":"string","description":"Path or absolute url of the page to read, as returned in a searchDocs result\'s `url`"}},"required":["path"]}}],' +
  '"usage":{"claudeCode":"claude mcp add --transport http fern_mcp_docs-paradex-trade https://docs.paradex.trade/_mcp/server","cursor":"Add \\"https://docs.paradex.trade/_mcp/server\\" to your MCP server configuration","generic":"POST JSON-RPC 2.0 messages to this URL"}}';

const TOOLS_LIST_JSON =
  '{"tools":[{"name":"searchDocs","description":"Search the documentation at https://docs.paradex.trade. Returns ranked results with title, url, section anchor and a snippet, in rank order. Use fetchPage to read a result in full.","inputSchema":{"type":"object","properties":{"query":{"type":"string","description":"The search query to run against the docs"},"topK":{"type":"integer","minimum":1,"maximum":20,"description":"How many results to return (default 8, max 20)"}},"required":["query"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"},"annotations":{"title":"Search docs.paradex.trade Docs","readOnlyHint":true},"execution":{"taskSupport":"forbidden"}},' +
  '{"name":"fetchPage","description":"Read one page of the documentation at https://docs.paradex.trade as markdown. Takes a path or url from a searchDocs result.","inputSchema":{"type":"object","properties":{"path":{"type":"string","description":"Path or absolute url of the page to read, as returned in a searchDocs result\'s `url`"}},"required":["path"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"},"annotations":{"title":"Fetch a docs.paradex.trade Docs page","readOnlyHint":true},"execution":{"taskSupport":"forbidden"}}]}';

describe('GET /_mcp/server', () => {
  test('returns the JSON descriptor with cache headers and Vary: Accept', async () => {
    for (const accept of [null, '*/*', 'text/html', 'application/json']) {
      const res = await send(new Request(MCP_URL, { headers: accept ? { accept } : {} }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/json');
      assert.equal(res.headers.get('cache-control'), 'public, s-maxage=60, stale-while-revalidate=60');
      assert.equal(res.headers.get('vary'), 'Accept');
      assert.equal(res.headers.get('access-control-allow-origin'), null);
      assert.equal(await res.text(), DESCRIPTOR_JSON);
    }
  });

  test('also answers with a trailing slash', async () => {
    const res = await send(new Request(`${MCP_URL}/`));
    assert.equal(await res.text(), DESCRIPTOR_JSON);
  });

  test('the server name follows Fern\'s fern_mcp_<domain> rule', () => {
    assert.equal(mcpServerName('docs.paradex.trade', ''), 'fern_mcp_docs-paradex-trade');
    assert.equal(mcpServerName('example.com', '/docs/v2'), 'fern_mcp_example-com-docs-v2');
    assert.equal(mcpServerName('', ''), 'fern_mcp');
    assert.equal(mcpDescriptor('http://localhost:8788').usage.claudeCode, 'claude mcp add --transport http fern_mcp_localhost-8788 http://localhost:8788/_mcp/server');
  });

  test('uses the configured site URL', async () => {
    const res = await send(new Request(MCP_URL), { siteUrl: 'https://docs.example.com/' });
    const body = await res.json();
    assert.equal(body.usage.cursor, 'Add "https://docs.example.com/_mcp/server" to your MCP server configuration');
    assert.equal(body.tools[0].annotations.title, 'Search docs.example.com Docs');
  });

  test('refuses an SSE stream with 405', async () => {
    const res = await send(new Request(MCP_URL, { headers: { accept: 'application/json, text/event-stream' } }));
    assert.equal(res.headers.get('allow'), 'POST, DELETE');
    assert.equal(res.headers.get('cache-control'), null);
    await expectJsonError(res, 405, -32000, 'Method Not Allowed: stateless MCP server does not support GET SSE streams. Use POST.');
  });
});

describe('other methods', () => {
  test('HEAD fails like Fern (500, empty body)', async () => {
    const res = await send(new Request(MCP_URL, { method: 'HEAD' }));
    assert.equal(res.status, 500);
    assert.equal(res.body, null);
  });

  test('OPTIONS is 204 with the route methods and no CORS headers', async () => {
    const res = await send(new Request(MCP_URL, { method: 'OPTIONS', headers: { origin: 'https://a.example' } }));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('allow'), 'DELETE, GET, HEAD, OPTIONS, POST');
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('PUT and PATCH are 405 with no body', async () => {
    for (const method of ['PUT', 'PATCH']) {
      const res = await send(new Request(MCP_URL, { method, body: '{}' }));
      assert.equal(res.status, 405);
      assert.equal(res.body, null);
    }
  });

  test('DELETE is a stateless no-op: 200, empty body', async () => {
    const res = await send(new Request(MCP_URL, { method: 'DELETE' }));
    assert.equal(res.status, 200);
    assert.equal(res.body, null);
    const ok = await send(new Request(MCP_URL, { method: 'DELETE', headers: { 'mcp-protocol-version': '2025-06-18' } }));
    assert.equal(ok.status, 200);
  });

  test('DELETE checks mcp-protocol-version', async () => {
    const res = await send(new Request(MCP_URL, { method: 'DELETE', headers: { 'mcp-protocol-version': '1.0' } }));
    await expectJsonError(res, 400, -32000, UNSUPPORTED('1.0'));
  });

  test('the kill switch answers 404 for GET, POST, DELETE and HEAD', async () => {
    for (const method of ['GET', 'POST', 'DELETE', 'HEAD']) {
      const request = method === 'POST' ? mcpRequest({ jsonrpc: '2.0', id: 1, method: 'ping' }) : new Request(MCP_URL, { method });
      const res = await send(request, { mcpServer: 'off' });
      assert.equal(res.status, 404, method);
      assert.equal(res.headers.get('content-type'), 'application/json');
      if (method !== 'HEAD') assert.equal(await res.text(), '{"error":"MCP is disabled for this docs site"}');
    }
    const options = await send(new Request(MCP_URL, { method: 'OPTIONS' }), { mcpServer: 'off' });
    assert.equal(options.status, 204);
  });
});

describe('legacy /mcp alias', () => {
  test('POST and DELETE reach the MCP server', async () => {
    const res = await send(mcpRequest({ jsonrpc: '2.0', id: 7, method: 'ping' }, { url: `${SITE}/mcp` }));
    assert.deepEqual(parseSse(await res.text()), [{ result: {}, jsonrpc: '2.0', id: 7 }]);
    const del = await send(new Request(`${SITE}/mcp`, { method: 'DELETE' }));
    assert.equal(del.status, 200);
  });

  test('GET /mcp and GET /mcp/ pass through', async () => {
    const passed = new Response('static');
    for (const request of [new Request(`${SITE}/mcp`), new Request(`${SITE}/mcp/`)]) {
      const res = await send(request, { next: () => passed });
      assert.equal(res, passed);
    }
  });

  test('a trailing slash still reaches the MCP server (Fern strips it)', async () => {
    for (const url of [`${SITE}/mcp/`, `${SITE}/mcp//`]) {
      const res = await send(mcpRequest({ jsonrpc: '2.0', id: 3, method: 'ping' }, { url }));
      assert.deepEqual(parseSse(await res.text()), [{ result: {}, jsonrpc: '2.0', id: 3 }]);
      const del = await send(new Request(url, { method: 'DELETE' }));
      assert.equal(del.status, 200);
    }
  });
});

describe('POST header and body validation', () => {
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };

  test('406 unless Accept has both application/json and text/event-stream', async () => {
    for (const accept of [null, 'application/json', 'text/event-stream', '*/*']) {
      const headers = { 'content-type': 'application/json' };
      if (accept) headers.accept = accept;
      const res = await send(new Request(MCP_URL, { method: 'POST', headers, body: JSON.stringify(ping) }));
      await expectJsonError(res, 406, -32000, 'Not Acceptable: Client must accept both application/json and text/event-stream');
    }
  });

  test('415 unless Content-Type contains application/json', async () => {
    for (const contentType of [null, 'text/plain']) {
      const headers = { accept: 'application/json, text/event-stream' };
      if (contentType) headers['content-type'] = contentType;
      const res = await send(new Request(MCP_URL, { method: 'POST', headers, body: JSON.stringify(ping) }));
      await expectJsonError(res, 415, -32000, 'Unsupported Media Type: Content-Type must be application/json');
    }
    const ok = await send(mcpRequest(ping, { headers: { 'content-type': 'application/json; charset=utf-8' } }));
    assert.equal(ok.status, 200);
  });

  test('400 -32700 for a body that is not JSON', async () => {
    for (const body of ['{bad json', '']) {
      await expectJsonError(await send(mcpRequest(body)), 400, -32700, 'Parse error: Invalid JSON');
    }
  });

  test('413 for a body over 4 MiB, by Content-Length or by what arrives (SDK 1.32 limit)', async () => {
    const message = 'Payload Too Large: Request body must not exceed 4194304 bytes';
    const big = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'searchDocs', arguments: { query: 'x'.repeat(4 * 1024 * 1024) } } });
    await expectJsonError(await send(mcpRequest(big)), 413, -32000, message);
    const declared = mcpRequest(JSON.stringify(ping), { headers: { 'content-length': String(4 * 1024 * 1024 + 1) } });
    await expectJsonError(await send(declared), 413, -32000, message);
    // A streamed body without Content-Length stops being read past the limit.
    const chunk = new TextEncoder().encode(' '.repeat(1024 * 1024));
    let pulled = 0;
    const stream = new ReadableStream({
      pull(controller) {
        pulled++;
        if (pulled > 20) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const streamed = new Request(MCP_URL, {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    });
    await expectJsonError(await send(streamed), 413, -32000, message);
    assert.ok(pulled <= 6, `read ${pulled} chunks`);
    const justUnder = JSON.stringify(ping) + ' '.repeat(4 * 1024 * 1024 - JSON.stringify(ping).length);
    assert.equal((await send(mcpRequest(justUnder))).status, 200);
  });

  test('400 -32600 for a batch of more than 100 messages (SDK 1.32 limit)', async () => {
    const batch = (n) => Array.from({ length: n }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'ping' }));
    await expectJsonError(await send(mcpRequest(batch(101))), 400, -32600, 'Invalid Request: Batch must not exceed 100 messages');
    const ok = await send(mcpRequest(batch(100)));
    assert.equal(ok.status, 200);
    assert.equal(parseSse(await ok.text()).length, 100);
  });

  test('400 -32700 for anything that is not a JSON-RPC message', async () => {
    const invalid = [
      5,
      'x',
      null,
      [1],
      { id: 1, method: 'ping' },
      { jsonrpc: '1.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', id: null, method: 'ping' },
      { jsonrpc: '2.0', id: 1.5, method: 'ping' },
      { jsonrpc: '2.0', id: 1, method: 5 },
      { jsonrpc: '2.0', id: 1, method: 'ping', extra: 1 },
      { jsonrpc: '2.0', id: 1, method: 'ping', params: [] },
      { jsonrpc: '2.0', id: 1, method: 'ping', params: null },
      { jsonrpc: '2.0', id: 1, method: 'ping', params: { _meta: { progressToken: 1.5 } } },
      { jsonrpc: '2.0', id: 1, result: 5 },
      { jsonrpc: '2.0', id: 1, error: { code: 1.5, message: 'x' } },
      [ping, { jsonrpc: '2.0' }],
    ];
    for (const body of invalid) {
      await expectJsonError(await send(mcpRequest(JSON.stringify(body))), 400, -32700, 'Parse error: Invalid JSON-RPC message');
    }
  });

  test('400 -32600 for an initialize request inside a batch', async () => {
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'c', version: '1' } } };
    const res = await send(mcpRequest([init, { jsonrpc: '2.0', method: 'notifications/initialized' }]));
    await expectJsonError(res, 400, -32600, 'Invalid Request: Only one initialization request is allowed');
  });

  test('400 for an unsupported mcp-protocol-version, except on initialize', async () => {
    const res = await send(mcpRequest(ping, { headers: { 'mcp-protocol-version': '2099-01-01' } }));
    await expectJsonError(res, 400, -32000, UNSUPPORTED('2099-01-01'));
    for (const version of VERSIONS) {
      assert.equal((await send(mcpRequest(ping, { headers: { 'mcp-protocol-version': version } }))).status, 200);
    }
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'c', version: '1' } } };
    const ok = await send(mcpRequest(init, { headers: { 'mcp-protocol-version': 'bogus' } }));
    assert.equal(ok.status, 200);
    // An initialize with invalid params is not an initialize request for the transport.
    const bad = await send(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { headers: { 'mcp-protocol-version': 'bogus' } }));
    await expectJsonError(bad, 400, -32000, UNSUPPORTED('bogus'));
  });
});

describe('POST responses', () => {
  test('202 with no body and no Content-Type when there are no requests', async () => {
    const bodies = [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      [{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 5, result: {} }],
      { jsonrpc: '2.0', id: 9, error: { code: -1, message: 'x' } },
      [],
    ];
    for (const body of bodies) {
      const res = await send(mcpRequest(body));
      assert.equal(res.status, 202);
      assert.equal(res.body, null);
      assert.equal(res.headers.get('content-type'), null);
    }
  });

  test('requests are answered as SSE events without a session id', async () => {
    const res = await send(mcpRequest({ jsonrpc: '2.0', id: 'abc', method: 'ping' }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.equal(res.headers.get('mcp-session-id'), null);
    assert.equal(await res.text(), 'event: message\ndata: {"result":{},"jsonrpc":"2.0","id":"abc"}\n\n');
  });

  test('an incoming mcp-session-id is ignored', async () => {
    const messages = await rpc({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-session-id': 'whatever' });
    assert.deepEqual(messages, [{ result: {}, jsonrpc: '2.0', id: 1 }]);
  });

  test('initialize negotiates the protocol version', async () => {
    for (const version of [...VERSIONS, '2023-01-01']) {
      const [message] = await rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: version, capabilities: { roots: { listChanged: true } }, clientInfo: { name: 'c', version: '1' } },
      });
      assert.deepEqual(message, {
        result: {
          protocolVersion: VERSIONS.includes(version) ? version : '2025-11-25',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'fern-docs-mcp-server', version: '1.0.0' },
        },
        jsonrpc: '2.0',
        id: 1,
      });
    }
  });

  test('unknown methods get -32601', async () => {
    for (const method of ['resources/list', 'prompts/list', 'logging/setLevel', 'completion/complete', 'tasks/list']) {
      const [message] = await rpc({ jsonrpc: '2.0', id: 3, method });
      assert.deepEqual(message, { jsonrpc: '2.0', id: 3, error: { code: -32601, message: 'Method not found' } });
    }
  });

  test('a batch gets every response on one stream, in completion order', async () => {
    const res = await send(
      mcpRequest([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', id: 2, method: 'nope' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      ]),
    );
    const messages = parseSse(await res.text());
    assert.deepEqual(
      messages.map((m) => m.id),
      [2, 1, 3],
    );
    assert.deepEqual(messages[0].error, { code: -32601, message: 'Method not found' });
    assert.equal(JSON.stringify(messages[2].result), TOOLS_LIST_JSON);
  });

  test('a repeated id is answered once; 1 and "1" are different ids', async () => {
    assert.equal((await rpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 1, method: 'ping' }])).length, 1);
    assert.equal((await rpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: '1', method: 'ping' }])).length, 2);
  });

  test('a request cancelled in the same batch gets no response and the stream still ends', async () => {
    const messages = await rpc([
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]);
    assert.deepEqual(messages, [{ result: {}, jsonrpc: '2.0', id: 2 }]);
  });

  test('a cancellation with a falsy requestId (0 or "") is ignored, as in the SDK', async () => {
    for (const id of [0, '']) {
      const messages = await rpc([
        { jsonrpc: '2.0', id, method: 'ping' },
        { jsonrpc: '2.0', id: 2, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: id } },
      ]);
      assert.deepEqual(messages, [
        { result: {}, jsonrpc: '2.0', id },
        { result: {}, jsonrpc: '2.0', id: 2 },
      ]);
    }
  });

  test('tools/list works without initialize and matches the SDK output', async () => {
    const [message] = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(JSON.stringify(message), `{"result":${TOOLS_LIST_JSON},"jsonrpc":"2.0","id":1}`);
    assert.equal(JSON.stringify({ tools: toolList(SITE) }), TOOLS_LIST_JSON);
  });

  test('request params are validated like the SDK (-32603 with the zod issues)', async () => {
    const cases = [
      [{ method: 'tools/call' }, [{ expected: 'object', code: 'invalid_type', path: ['params'], message: 'Invalid input' }]],
      [{ method: 'tools/call', params: {} }, [{ expected: 'string', code: 'invalid_type', path: ['params', 'name'], message: 'Invalid input' }]],
      [
        { method: 'tools/call', params: { name: 'searchDocs', arguments: [1] } },
        [{ expected: 'record', code: 'invalid_type', path: ['params', 'arguments'], message: 'Invalid input' }],
      ],
      [
        { method: 'tools/call', params: { name: 'searchDocs', arguments: { query: 'x' }, task: { ttl: 'a' } } },
        [{ expected: 'number', code: 'invalid_type', path: ['params', 'task', 'ttl'], message: 'Invalid input' }],
      ],
      [{ method: 'tools/list', params: { cursor: 5 } }, [{ expected: 'string', code: 'invalid_type', path: ['params', 'cursor'], message: 'Invalid input' }]],
      [
        { method: 'initialize', params: { protocolVersion: '2025-06-18' } },
        [
          { expected: 'object', code: 'invalid_type', path: ['params', 'capabilities'], message: 'Invalid input' },
          { expected: 'object', code: 'invalid_type', path: ['params', 'clientInfo'], message: 'Invalid input' },
        ],
      ],
      [
        { method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: { roots: { listChanged: 'y' } }, clientInfo: { name: 'x', version: '1' } } },
        [{ expected: 'boolean', code: 'invalid_type', path: ['params', 'capabilities', 'roots', 'listChanged'], message: 'Invalid input' }],
      ],
    ];
    for (const [request, issues] of cases) {
      const [message] = await rpc({ jsonrpc: '2.0', id: 1, ...request });
      assert.deepEqual(message, { jsonrpc: '2.0', id: 1, error: { code: -32603, message: JSON.stringify(issues, null, 2) } });
    }
  });

  test('initialize capabilities and icons are checked like Fern\'s schema', async () => {
    const init = (capabilities, clientInfo = { name: 'x', version: '1' }) => ({
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities, clientInfo },
    });
    const type = (expected, path) => ({ expected, code: 'invalid_type', path: ['params', ...path], message: 'Invalid input' });
    const custom = (path) => ({ code: 'custom', path: ['params', ...path], message: 'Invalid input' });
    const caps = ['capabilities'];
    const cases = [
      [init({ elicitation: { form: 'x' } }), [type('object', [...caps, 'elicitation', 'form']), type('record', [...caps, 'elicitation', 'form'])]],
      [init({ elicitation: 'x' }), [type('object', [...caps, 'elicitation']), type('record', [...caps, 'elicitation'])]],
      [init({ elicitation: { url: true } }), [custom([...caps, 'elicitation', 'url'])]],
      [init({ elicitation: { form: { applyDefaults: 'y' } } }), [type('boolean', [...caps, 'elicitation', 'form', 'applyDefaults'])]],
      [init({ tasks: { list: true } }), [custom([...caps, 'tasks', 'list'])]],
      [init({ tasks: { requests: { sampling: { createMessage: 1 } } } }), [custom([...caps, 'tasks', 'requests', 'sampling', 'createMessage'])]],
      [init({ tasks: { requests: 'x' } }), [type('object', [...caps, 'tasks', 'requests'])]],
      [
        init({}, { name: 'x', version: '1', icons: [{ src: 'x', theme: 'blue' }] }),
        [{ code: 'invalid_value', values: ['light', 'dark'], path: ['params', 'clientInfo', 'icons', 0, 'theme'], message: 'Invalid input' }],
      ],
      [init({}, { name: 'x', version: '1', icons: [{ src: 'x', sizes: 'big' }] }), [type('array', ['clientInfo', 'icons', 0, 'sizes'])]],
      [init({}, { name: 'x', version: '1', icons: [{ src: 'x', sizes: [1] }] }), [type('string', ['clientInfo', 'icons', 0, 'sizes', 0])]],
    ];
    for (const [request, issues] of cases) {
      const [message] = await rpc({ jsonrpc: '2.0', id: 1, ...request });
      assert.deepEqual(message, { jsonrpc: '2.0', id: 1, error: { code: -32603, message: JSON.stringify(issues, null, 2) } }, JSON.stringify(request));
    }
    // Valid shapes still initialize.
    for (const capabilities of [{ elicitation: {} }, { elicitation: { form: { applyDefaults: true }, url: {} } }, { tasks: { list: {}, requests: { elicitation: { create: {} } } } }]) {
      const [message] = await rpc({ jsonrpc: '2.0', id: 1, ...init(capabilities, { name: 'x', version: '1', icons: [{ src: 'x', sizes: ['48x48'], theme: 'dark' }] }) });
      assert.equal(message.result?.serverInfo?.name, 'fern-docs-mcp-server', JSON.stringify(capabilities));
    }
  });

  test('an invalid initialize is an ordinary request: it may share a batch and the version header is checked', async () => {
    const bad = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: { elicitation: { form: 'x' } }, clientInfo: { name: 'x', version: '1' } } };
    const messages = await rpc([bad, { jsonrpc: '2.0', id: 2, method: 'ping' }]);
    assert.equal(messages.length, 2);
    assert.equal(messages.find((m) => m.id === 1).error.code, -32603);
    assert.deepEqual(messages.find((m) => m.id === 2).result, {});
    const res = await send(mcpRequest(bad, { headers: { 'mcp-protocol-version': 'bogus' } }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error.message, /^Bad Request: Unsupported protocol version: bogus/);
  });

  test('task-augmented requests are refused (no tasks capability)', async () => {
    for (const method of ['tools/call', 'tools/list', 'ping']) {
      const params = method === 'tools/call' ? { name: 'searchDocs', arguments: { query: 'x' }, task: {} } : { task: { ttl: 5 } };
      const [message] = await rpc({ jsonrpc: '2.0', id: 1, method, params });
      assert.deepEqual(message.error, { code: -32603, message: `Server does not support task creation (required for ${method})` });
    }
  });
});

describe('tools/call', () => {
  const inputError = (tool, issues) => ({
    content: [{ type: 'text', text: `MCP error -32602: Input validation error: Invalid arguments for tool ${tool}: ${JSON.stringify(issues, null, 2)}` }],
    isError: true,
  });

  test('an unknown tool is a tool error, not a JSON-RPC error', async () => {
    assert.deepEqual(await call('reportIssue', {}), { content: [{ type: 'text', text: 'MCP error -32602: Tool reportIssue not found' }], isError: true });
    // Object.prototype members are found by the SDK's lookup but have no `enabled` flag.
    for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      assert.deepEqual(await call(name, {}), { content: [{ type: 'text', text: `MCP error -32602: Tool ${name} disabled` }], isError: true });
    }
  });

  test('invalid arguments report the zod issues', async () => {
    const required = (path, expected = 'string') => ({ code: 'invalid_type', expected, received: 'undefined', path, message: 'Required' });
    assert.deepEqual(await call('searchDocs', undefined), inputError('searchDocs', [required([], 'object')]));
    assert.deepEqual(await call('searchDocs', {}), inputError('searchDocs', [required(['query'])]));
    assert.deepEqual(await call('fetchPage', {}), inputError('fetchPage', [required(['path'])]));
    assert.deepEqual(
      await call('fetchPage', { path: 7 }),
      inputError('fetchPage', [{ code: 'invalid_type', expected: 'string', received: 'number', path: ['path'], message: 'Expected string, received number' }]),
    );
    const notInt = { code: 'invalid_type', expected: 'integer', received: 'float', message: 'Expected integer, received float', path: ['topK'] };
    const tooSmall = { code: 'too_small', minimum: 1, type: 'number', inclusive: true, exact: false, message: 'Number must be greater than or equal to 1', path: ['topK'] };
    const tooBig = { code: 'too_big', maximum: 20, type: 'number', inclusive: true, exact: false, message: 'Number must be less than or equal to 20', path: ['topK'] };
    assert.deepEqual(await call('searchDocs', { query: 'a', topK: 0 }), inputError('searchDocs', [tooSmall]));
    assert.deepEqual(await call('searchDocs', { query: 'a', topK: 21 }), inputError('searchDocs', [tooBig]));
    assert.deepEqual(await call('searchDocs', { query: 'a', topK: 1.5 }), inputError('searchDocs', [notInt]));
    assert.deepEqual(await call('searchDocs', { query: 'a', topK: 0.5 }), inputError('searchDocs', [notInt, tooSmall]));
    assert.deepEqual(
      await call('searchDocs', { query: true, topK: '3' }),
      inputError('searchDocs', [
        { code: 'invalid_type', expected: 'string', received: 'boolean', path: ['query'], message: 'Expected string, received boolean' },
        { code: 'invalid_type', expected: 'number', received: 'string', path: ['topK'], message: 'Expected number, received string' },
      ]),
    );
  });

  test('searchDocs returns ranked results as JSON text and structuredContent', async () => {
    const result = await call('searchDocs', { query: 'BTC-USD-PERP', extra: 'ignored' });
    const { results } = result.structuredContent;
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].text, JSON.stringify({ results }, null, 2));
    assert.ok(results.length >= 2 && results.length <= 8);
    assert.deepEqual(Object.keys(results[0]), ['rank', 'title', 'url', 'anchor', 'kind', 'snippet', 'score']);
    assert.equal(results[0].rank, 1);
    assert.equal(results[0].url, `${SITE}/trading/instruments-guide/futures/tier-1/btc-usd-perp`);
    assert.equal(results[0].anchor, null);
    assert.equal(results[1].anchor, 'contract-specifications');
    assert.equal(results[0].kind, 'page');
    assert.equal(result.isError, undefined);
  });

  test('searchDocs honours topK and loads the index once', async () => {
    const one = await call('searchDocs', { query: 'orders', topK: 1 });
    assert.equal(one.structuredContent.results.length, 1);
    await call('searchDocs', { query: 'fees' });
    assert.equal(site.calls.filter((p) => p === '/_mcp/search-index.json').length, 1);
  });

  test('searchDocs says "No results found." when nothing matches', async () => {
    assert.deepEqual(await call('searchDocs', { query: 'xyzzyplugh' }), { content: [{ type: 'text', text: 'No results found.' }] });
    assert.deepEqual(await call('searchDocs', { query: '' }), { content: [{ type: 'text', text: 'No results found.' }] });
  });

  test('searchDocs reports a missing index as a plain-text failure', async () => {
    site = createSite({ '/_mcp/search-index.json': null });
    assert.deepEqual(await call('searchDocs', { query: 'fees' }), {
      content: [{ type: 'text', text: 'Search failed: Search index is unavailable (status 404)' }],
    });
  });

  test('fetchPage returns the page Markdown with its url (Fern sets no title)', async () => {
    const result = await call('fetchPage', { path: '/docs/getting-started/what-is-paradex' });
    assert.deepEqual(result, {
      content: [{ type: 'text', text: WHAT_IS_MD }],
      structuredContent: { url: `${SITE}/docs/getting-started/what-is-paradex` },
    });
    assert.deepEqual(site.calls, ['/docs/getting-started/what-is-paradex.md']);
  });

  test('fetchPage resolves paths like Fern', async () => {
    const page = `${SITE}/docs/getting-started/what-is-paradex`;
    for (const path of [
      'docs/getting-started/what-is-paradex',
      'docs/getting-started/what-is-paradex/',
      '/docs/getting-started/what-is-paradex.md',
      page,
      `${page}#privacy`,
    ]) {
      const result = await call('fetchPage', { path });
      assert.deepEqual(result.structuredContent, { url: page }, path);
    }
    const home = await call('fetchPage', { path: '/' });
    assert.deepEqual(home, { content: [{ type: 'text', text: HOME_MD }], structuredContent: { url: `${SITE}/` } });
  });

  test('fetchPage keeps the query string, which applies the .md filters', async () => {
    const result = await call('fetchPage', { path: '/api/prod/orders/new?excludeSpec=true#examples' });
    assert.equal(result.structuredContent.url, `${SITE}/api/prod/orders/new?excludeSpec=true`);
    assert.ok(!result.content[0].text.includes('## Authentication'));
    assert.ok(result.content[0].text.includes('## Examples'));
    const full = await call('fetchPage', { path: '/api/prod/orders/new' });
    assert.equal(full.content[0].text, CREATE_ORDER_MD);
  });

  test('fetchPage refuses other origins without fetching them', async () => {
    const cases = {
      '//evil.com/x': 'Fetch failed: Path is outside https://docs.paradex.trade: //evil.com/x',
      'https://evil.com/docs': 'Fetch failed: Path is outside https://docs.paradex.trade: https://evil.com/docs',
      'http://docs.paradex.trade/docs': 'Fetch failed: Path is outside https://docs.paradex.trade: http://docs.paradex.trade/docs',
      'https://docs.paradex.trade:8443/docs': 'Fetch failed: Path is outside https://docs.paradex.trade: https://docs.paradex.trade:8443/docs',
      'javascript:alert(1)': 'Fetch failed: Path is outside https://docs.paradex.trade: javascript:alert(1)',
      'http://[': 'Fetch failed: Not a valid docs path: http://[',
    };
    for (const [path, text] of Object.entries(cases)) {
      assert.deepEqual(await call('fetchPage', { path }), { content: [{ type: 'text', text }] }, path);
    }
    assert.deepEqual(site.calls, []);
  });

  test('fetchPage follows a legacy URL\'s Markdown redirect, like fetch() did on Fern', async () => {
    site = createSite({ '/_redirects': '/overview/* /docs/:splat 301\n/staking.md /docs/getting-started/what-is-paradex.md#x 308\n' });
    for (const path of ['/overview/getting-started/what-is-paradex', '/staking']) {
      const result = await call('fetchPage', { path });
      assert.deepEqual(result, { content: [{ type: 'text', text: WHAT_IS_MD }], structuredContent: { url: `${SITE}${path}` } }, path);
    }
  });

  test('fetchPage of a missing page returns the agent not-found text', async () => {
    const result = await call('fetchPage', { path: '/api/prod/orders/neww' });
    assert.equal(
      result.content[0].text,
      `# Page Not Found\n\nThis page does not exist.\n\n## Similar pages\n\n- [Create order](${SITE}/api/prod/orders/new.md)\n- [Get open orders](${SITE}/api/prod/orders/get-orders.md)\n- [Rate Limits](${SITE}/api/general-information/rate-limits.md)\n`,
    );
    assert.deepEqual(result.structuredContent, { url: `${SITE}/api/prod/orders/neww` });
  });

  test('fetchPage maps a failing host to Fern\'s error texts', async () => {
    const failing = (status) => async () => new Response('boom', { status, headers: { 'content-type': 'text/plain' } });
    let res = await send(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path: '/docs/x' } } }), {
      fetchAsset: failing(503),
    });
    assert.equal(parseSse(await res.text())[0].result.content[0].text, `Fetch failed: Could not read ${SITE}/docs/x (status 503)`);
    res = await send(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path: '/docs/x' } } }), {
      fetchAsset: failing(500),
    });
    assert.equal(parseSse(await res.text())[0].result.content[0].text, `Fetch failed: Could not read ${SITE}/docs/x (status 500)`);
  });
});

describe('search index loading', () => {
  test('concurrent cold searches build the index once', async () => {
    const cold = createEdge();
    const fetchAsset = async (path) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return site.fetchAsset(path);
    };
    const search = (i) =>
      cold.handle(mcpRequest({ jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: 'searchDocs', arguments: { query: 'trading fees', topK: 1 } } }), { fetchAsset });
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => search(i + 1)));
    for (const res of responses) {
      const [message] = parseSse(await res.text());
      assert.equal(message.result.structuredContent.results[0].url, `${SITE}/trading/trading-fees`);
    }
    assert.equal(cold.stats.indexBuilds, 1);
  });
});

describe('fetchPage never leaves the site', () => {
  test('dot segments and encoded dots cannot turn the path into another host', async () => {
    const seen = [];
    const fetchAsset = (path) => {
      seen.push(path);
      return site.fetchAsset(path);
    };
    const fetchPage = async (path) => {
      const res = await edge.handle(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path } } }), { fetchAsset });
      return parseSse(await res.text())[0].result.content[0].text;
    };
    for (const path of ['/.//127.0.0.1:9999/secret', '/a/..//127.0.0.1:9999/secret', '/%2e//127.0.0.1:9999/secret']) {
      assert.match(await fetchPage(path), /^# Page Not Found/, path);
    }
    // A protocol-relative path names another origin and is refused outright.
    assert.equal(await fetchPage('//127.0.0.1:9999/secret'), 'Fetch failed: Path is outside https://docs.paradex.trade: //127.0.0.1:9999/secret');
    assert.ok(seen.length > 0);
    for (const path of seen) assert.ok(!path.startsWith('//') && !path.includes('\\'), path);
  });

  test('an overlong path is refused before any work', async () => {
    const res = await send(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fetchPage', arguments: { path: `/a${'/'.repeat(8000)}b` } } }));
    const [message] = parseSse(await res.text());
    assert.match(message.result.content[0].text, /^Fetch failed: Not a valid docs path: /);
  });
});

describe('resolveDocsPath', () => {
  test('matches Fern\'s am() examples', () => {
    assert.deepEqual(resolveDocsPath('docs/trading/fees/', SITE), {
      pageUrl: `${SITE}/docs/trading/fees`,
      markdownUrl: `${SITE}/docs/trading/fees.md`,
    });
    assert.deepEqual(resolveDocsPath('/docs/x?y=1#h', SITE), { pageUrl: `${SITE}/docs/x?y=1`, markdownUrl: `${SITE}/docs/x.md?y=1` });
    assert.deepEqual(resolveDocsPath('/', SITE), { pageUrl: `${SITE}/`, markdownUrl: `${SITE}/.md` });
    assert.deepEqual(resolveDocsPath('/docs/x.md', SITE), { pageUrl: `${SITE}/docs/x`, markdownUrl: `${SITE}/docs/x.md` });
    assert.deepEqual(resolveDocsPath('../../docs/x', SITE), { pageUrl: `${SITE}/docs/x`, markdownUrl: `${SITE}/docs/x.md` });
  });

  test('enforces a basepath', () => {
    assert.equal(resolveDocsPath('guide', 'https://example.com/docs').markdownUrl, 'https://example.com/docs/guide.md');
    assert.throws(() => resolveDocsPath('/other', 'https://example.com/docs'), { message: 'Path is outside https://example.com/docs: /other' });
  });
});
