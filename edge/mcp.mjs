// The docs MCP server at /_mcp/server, reproducing Fern's fern-docs-mcp-server
// (stateless Streamable HTTP, MCP TypeScript SDK semantics) with its
// "structured search" tool set: searchDocs (ranked results from our own
// index) and fetchPage (a page's Markdown). Fern's reportIssue tool is not
// implemented.

import {
  isInitializeRequest,
  isJsonRpcError,
  isJsonRpcMessage,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResult,
  isPlainObject,
  validateParams,
  validateToolArguments,
  zodErrorMessage,
} from './jsonrpc.mjs';
import { collapseSlashes, trimTrailingSlashes } from './paths.mjs';

export const SERVER_NAME = 'fern-docs-mcp-server';
export const SERVER_VERSION = '1.0.0';
export const MCP_PATH = '/_mcp/server';
export const LATEST_PROTOCOL_VERSION = '2025-11-25';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];

const ErrorCode = {
  ConnectionClosed: -32000,
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
};

const QUERY_DESCRIPTION = 'The search query to run against the docs';
const TOPK_DESCRIPTION = 'How many results to return (default 8, max 20)';
const PATH_DESCRIPTION = "Path or absolute url of the page to read, as returned in a searchDocs result's `url`";
const DESCRIPTOR_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=60';

// Request limits of the current MCP SDK transport (1.32: requestBody.js),
// which Fern's older bundled SDK lacked; every request here runs in a small
// Worker isolate.
export const MAX_REQUEST_BODY_SIZE = 4 * 1024 * 1024;
export const MAX_BATCH_SIZE = 100;
/** Longest fetchPage path accepted (no docs URL is near this long). */
export const MAX_DOCS_PATH_LENGTH = 2048;

/** Site identity used in descriptions: "https://docs.paradex.trade" and its host. */
export function siteIdentity(siteUrl) {
  const url = new URL(siteUrl);
  const basepath = url.pathname.replace(/\/+$/, '');
  return { base: `${url.protocol}//${url.host}${basepath}`, pureDomain: url.host, basepath };
}

/** Fern's MCP server name rule: fern_mcp_<domain+basepath with non [A-Za-z0-9_-] runs as "-">. */
export function mcpServerName(pureDomain, basepath) {
  const slug = `${pureDomain}${basepath}`
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `fern_mcp_${slug}` : 'fern_mcp';
}

function searchDescription(base) {
  return `Search the documentation at ${base}. Returns ranked results with title, url, section anchor and a snippet, in rank order. Use fetchPage to read a result in full.`;
}

function fetchDescription(base) {
  return `Read one page of the documentation at ${base} as markdown. Takes a path or url from a searchDocs result.`;
}

/** GET /_mcp/server body (Fern's hand-written descriptor schemas). */
export function mcpDescriptor(siteUrl) {
  const { base, pureDomain, basepath } = siteIdentity(siteUrl);
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: `MCP server for ${base} documentation. Provides AI-powered search over the documentation.`,
    transport: 'streamable-http',
    tools: [
      {
        name: 'searchDocs',
        description: searchDescription(base),
        annotations: { title: `Search ${pureDomain} Docs`, readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: QUERY_DESCRIPTION },
            topK: { type: 'integer', description: TOPK_DESCRIPTION },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetchPage',
        description: fetchDescription(base),
        annotations: { title: `Fetch a ${pureDomain} Docs page`, readOnlyHint: true },
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: PATH_DESCRIPTION } },
          required: ['path'],
        },
      },
    ],
    usage: {
      claudeCode: `claude mcp add --transport http ${mcpServerName(pureDomain, basepath)} ${base}${MCP_PATH}`,
      cursor: `Add "${base}${MCP_PATH}" to your MCP server configuration`,
      generic: 'POST JSON-RPC 2.0 messages to this URL',
    },
  };
}

/** tools/list entries (zod-to-json-schema output of Fern's zod v3 shapes). */
export function toolList(siteUrl) {
  const { base, pureDomain } = siteIdentity(siteUrl);
  return [
    {
      name: 'searchDocs',
      description: searchDescription(base),
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: QUERY_DESCRIPTION },
          topK: { type: 'integer', minimum: 1, maximum: 20, description: TOPK_DESCRIPTION },
        },
        required: ['query'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
      annotations: { title: `Search ${pureDomain} Docs`, readOnlyHint: true },
      execution: { taskSupport: 'forbidden' },
    },
    {
      name: 'fetchPage',
      description: fetchDescription(base),
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: PATH_DESCRIPTION } },
        required: ['path'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
      annotations: { title: `Fetch a ${pureDomain} Docs page`, readOnlyHint: true },
      execution: { taskSupport: 'forbidden' },
    },
  ];
}

const TOOL_FIELDS = {
  searchDocs: [
    { name: 'query', type: 'string' },
    { name: 'topK', type: 'integer', optional: true, min: 1, max: 20 },
  ],
  fetchPage: [{ name: 'path', type: 'string' }],
};

class McpError extends Error {
  constructor(code, message) {
    super(`MCP error ${code}: ${message}`);
    this.code = code;
  }
}

/** Error thrown by fetchPage path resolution (Fern's am()). */
export class DocsPathError extends Error {}

/**
 * Fern's fetchPage path resolution. Relative, root-relative and absolute
 * inputs resolve against the site; other origins are refused; the hash is
 * dropped and the query kept; trailing slashes are removed; ".md" is added
 * unless present.
 */
export function resolveDocsPath(path, baseUrl) {
  if (path.length > MAX_DOCS_PATH_LENGTH) throw new DocsPathError(`Not a valid docs path: ${path.slice(0, 200)}…`);
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  let target;
  try {
    target = new URL(path, base);
  } catch {
    throw new DocsPathError(`Not a valid docs path: ${path}`);
  }
  if (target.origin !== base.origin) throw new DocsPathError(`Path is outside ${base.origin}: ${path}`);
  target.hash = '';
  // Dot segments can leave a pathname such as "//host/x" ("/.//host/x"):
  // collapse repeated slashes so it can never be read as another host.
  const pathname = trimTrailingSlashes(collapseSlashes(target.pathname));
  const basepath = trimTrailingSlashes(base.pathname);
  if (basepath !== '' && pathname !== basepath && !pathname.startsWith(`${basepath}/`)) {
    throw new DocsPathError(`Path is outside ${base.origin}${basepath}: ${path}`);
  }
  const markdown = new URL(target.toString());
  markdown.pathname = pathname.endsWith('.md') ? pathname : `${pathname}.md`;
  const page = new URL(target.toString());
  page.pathname = pathname.endsWith('.md') ? pathname.slice(0, -3) : pathname;
  return { pageUrl: page.toString(), markdownUrl: markdown.toString() };
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}

async function searchDocsTool({ query, topK }, deps) {
  try {
    const results = await deps.searchDocs(query, topK ?? 8);
    if (results == null || results.length === 0) return textResult('No results found.');
    return {
      content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }],
      structuredContent: { results },
    };
  } catch (e) {
    return textResult(`Search failed: ${errorMessage(e)}`);
  }
}

async function fetchPageTool({ path }, deps) {
  try {
    const { pageUrl, markdownUrl } = resolveDocsPath(path, deps.siteUrl);
    const res = await deps.fetchMarkdown(markdownUrl);
    if (!res.ok) {
      throw new DocsPathError(
        res.status === 404 ? `No page found at ${pageUrl}` : `Could not read ${pageUrl} (status ${res.status})`,
      );
    }
    // Fern's fetcher never sets a title, so structuredContent is just {url}.
    return {
      content: [{ type: 'text', text: await res.text() }],
      structuredContent: { url: pageUrl },
    };
  } catch (e) {
    return textResult(`Fetch failed: ${errorMessage(e)}`);
  }
}

const TOOLS = { searchDocs: searchDocsTool, fetchPage: fetchPageTool };

/** McpServer's tools/call handler: every failure becomes an isError result. */
async function callTool(params, deps) {
  try {
    const name = params.name;
    const tool = Object.prototype.hasOwnProperty.call(TOOLS, name) ? TOOLS[name] : undefined;
    // The SDK looks tools up as `_registeredTools[name]`, so an
    // Object.prototype member (constructor, toString, __proto__) is found but
    // has no `enabled` flag: "disabled", not "not found".
    if (!tool && name in Object.prototype) throw new McpError(ErrorCode.InvalidParams, `Tool ${name} disabled`);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
    const parsed = validateToolArguments(params.arguments, TOOL_FIELDS[name]);
    if (parsed.issues) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Input validation error: Invalid arguments for tool ${name}: ${JSON.stringify(parsed.issues, null, 2)}`,
      );
    }
    return await tool(parsed.data, deps);
  } catch (e) {
    return { content: [{ type: 'text', text: errorMessage(e) }], isError: true };
  }
}

/** Runs one request handler; resolves to the JSON-RPC result or throws. */
async function runHandler(message, deps) {
  const params = message.params;
  // Protocol: a request carrying params.task needs the server's tasks capability.
  if (isPlainObject(params) && isPlainObject(params.task)) {
    const ttl = params.task.ttl;
    if (ttl === undefined || (typeof ttl === 'number' && Number.isFinite(ttl))) {
      throw new Error(`Server does not support task creation (required for ${message.method})`);
    }
  }
  const issues = validateParams(message.method, params);
  if (issues.length > 0) throw new Error(zodErrorMessage(issues)); // no code: answered as -32603
  switch (message.method) {
    case 'ping':
      return {};
    case 'initialize': {
      const requested = params.protocolVersion;
      return {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      };
    }
    case 'tools/list':
      return { tools: toolList(deps.siteUrl) };
    case 'tools/call':
      return callTool(params, deps);
    default:
      throw new Error(`Unexpected method ${message.method}`);
  }
}

const HANDLED_METHODS = new Set(['ping', 'initialize', 'tools/list', 'tools/call']);

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function jsonRpcErrorResponse(status, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return jsonResponse({ jsonrpc: '2.0', error, id: null }, status);
}

function unsupportedVersion(request) {
  const version = request.headers.get('mcp-protocol-version');
  if (version !== null && !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
    return jsonRpcErrorResponse(
      400,
      ErrorCode.ConnectionClosed,
      `Bad Request: Unsupported protocol version: ${version} (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`,
    );
  }
  return null;
}

/**
 * Reads a request body as text, up to `maxBytes` (the SDK's readRequestBody):
 * a declared Content-Length over the limit is refused without reading, and
 * the read stops once more than the limit has arrived.
 */
async function readRequestBody(request, maxBytes = MAX_REQUEST_BODY_SIZE) {
  if (Number(request.headers.get('content-length')) > maxBytes) return { tooLarge: true };
  if (request.body === null) return { tooLarge: false, text: '' };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) return { tooLarge: true };
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return { tooLarge: false, text: text + decoder.decode() };
}

/**
 * Dispatches a batch and streams the responses as SSE events in the order
 * they complete, closing the stream once every request has its response
 * (like the SDK transport: "Method not found" errors are written while
 * dispatching, handler results after it).
 */
function streamResponses(messages, deps) {
  const encoder = new TextEncoder();
  let controller;
  let closed = false;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true; // the client went away
    },
  });
  const pending = new Map(); // request id -> true; Map keeps 1 and "1" apart
  for (const m of messages) if (isJsonRpcRequest(m)) pending.set(m.id, true);
  const closeIfDone = () => {
    if (!closed && pending.size === 0) {
      closed = true;
      controller.close();
    }
  };
  const send = (response) => {
    if (closed || !pending.has(response.id)) return;
    controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(response)}\n\n`));
    pending.delete(response.id);
    closeIfDone();
  };
  const cancelled = new Set();

  for (const m of messages) {
    if (isJsonRpcResult(m) || isJsonRpcError(m)) continue; // responses to server requests: none outstanding
    if (isJsonRpcRequest(m)) {
      if (!HANDLED_METHODS.has(m.method)) {
        send({ jsonrpc: '2.0', id: m.id, error: { code: ErrorCode.MethodNotFound, message: 'Method not found' } });
        continue;
      }
      Promise.resolve()
        .then(() => runHandler(m, deps))
        .then(
          (result) => (cancelled.has(m.id) ? null : { result, jsonrpc: '2.0', id: m.id }),
          (e) =>
            cancelled.has(m.id)
              ? null
              : {
                  jsonrpc: '2.0',
                  id: m.id,
                  error: {
                    code: Number.isSafeInteger(e?.code) ? e.code : ErrorCode.InternalError,
                    message: e?.message ?? 'Internal error',
                  },
                },
        )
        .then((response) => {
          if (response) send(response);
          else {
            pending.delete(m.id);
            closeIfDone();
          }
        });
      continue;
    }
    if (
      isJsonRpcNotification(m) &&
      m.method === 'notifications/cancelled' &&
      isPlainObject(m.params) &&
      (m.params.reason === undefined || typeof m.params.reason === 'string')
    ) {
      // The SDK aborts the handler and never answers it. (It would also keep
      // the stream open forever; here the stream closes once the others finish.)
      // Protocol._oncancel: `if (!params.requestId) return;` (0 and "" are ignored).
      const id = m.params.requestId;
      if (id && pending.has(id)) cancelled.add(id);
    }
  }
  closeIfDone();
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}

async function handlePost(request, deps) {
  try {
    const accept = request.headers.get('accept');
    if (!accept?.includes('application/json') || !accept.includes('text/event-stream')) {
      return jsonRpcErrorResponse(
        406,
        ErrorCode.ConnectionClosed,
        'Not Acceptable: Client must accept both application/json and text/event-stream',
      );
    }
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return jsonRpcErrorResponse(415, ErrorCode.ConnectionClosed, 'Unsupported Media Type: Content-Type must be application/json');
    }
    let raw;
    try {
      const body = await readRequestBody(request);
      if (body.tooLarge) {
        return jsonRpcErrorResponse(413, ErrorCode.ConnectionClosed, `Payload Too Large: Request body must not exceed ${MAX_REQUEST_BODY_SIZE} bytes`);
      }
      raw = JSON.parse(body.text);
    } catch {
      return jsonRpcErrorResponse(400, ErrorCode.ParseError, 'Parse error: Invalid JSON');
    }
    if (Array.isArray(raw) && raw.length > MAX_BATCH_SIZE) {
      return jsonRpcErrorResponse(400, ErrorCode.InvalidRequest, `Invalid Request: Batch must not exceed ${MAX_BATCH_SIZE} messages`);
    }
    const messages = Array.isArray(raw) ? raw : [raw];
    if (!messages.every(isJsonRpcMessage)) {
      return jsonRpcErrorResponse(400, ErrorCode.ParseError, 'Parse error: Invalid JSON-RPC message');
    }
    const hasInitialize = messages.some(isInitializeRequest);
    if (hasInitialize && messages.length > 1) {
      return jsonRpcErrorResponse(400, ErrorCode.InvalidRequest, 'Invalid Request: Only one initialization request is allowed');
    }
    if (!hasInitialize) {
      const versionError = unsupportedVersion(request);
      if (versionError) return versionError;
    }
    // A cancellation notification aimed at a request in the same batch still
    // counts as a request batch; only batches without requests get 202.
    if (!messages.some(isJsonRpcRequest)) return new Response(null, { status: 202 });
    return streamResponses(messages, deps);
  } catch (e) {
    return jsonRpcErrorResponse(400, ErrorCode.ParseError, 'Parse error', String(e));
  }
}

/**
 * Handles a request routed to the MCP endpoint.
 * deps: {siteUrl, enabled, searchDocs(query, topK), fetchMarkdown(markdownUrl)}.
 */
export async function handleMcp(request, deps) {
  const method = request.method;
  if (method === 'OPTIONS') {
    // Next.js answers OPTIONS on the route itself (before the handler).
    return new Response(null, { status: 204, headers: { Allow: 'DELETE, GET, HEAD, OPTIONS, POST' } });
  }
  if (!['GET', 'HEAD', 'POST', 'DELETE'].includes(method)) return new Response(null, { status: 405 });
  if (deps.enabled === false) {
    const disabled = jsonResponse({ error: 'MCP is disabled for this docs site' }, 404);
    return method === 'HEAD' ? new Response(null, { status: 404, headers: disabled.headers }) : disabled;
  }
  if (method === 'GET') {
    if (request.headers.get('accept')?.includes('text/event-stream') === true) {
      return jsonResponse(
        {
          jsonrpc: '2.0',
          error: {
            code: ErrorCode.ConnectionClosed,
            message: 'Method Not Allowed: stateless MCP server does not support GET SSE streams. Use POST.',
          },
          id: null,
        },
        405,
        { Allow: 'POST, DELETE' },
      );
    }
    return jsonResponse(mcpDescriptor(deps.siteUrl), 200, { 'Cache-Control': DESCRIPTOR_CACHE_CONTROL, Vary: 'Accept' });
  }
  if (method === 'HEAD') {
    // Fern's route throws "[mcp] unsupported method: HEAD" (Next.js runs the
    // GET handler for HEAD), which Next.js answers with an empty 500.
    return new Response(null, { status: 500 });
  }
  if (method === 'DELETE') {
    return unsupportedVersion(request) ?? new Response(null, { status: 200 });
  }
  return handlePost(request, deps);
}
