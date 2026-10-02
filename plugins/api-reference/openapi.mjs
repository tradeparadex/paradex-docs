// OpenAPI -> endpoint pages, reproducing Fern's URLs, labels and samples.
//
// URL of an endpoint: <section URL>/<group>/<method>, both kebab-cased.
//   group:  x-fern-sdk-group-name from overrides.yml, else the first tag;
//   method: x-fern-sdk-method-name, else the operationId with a leading
//           tag prefix removed (`orders-modify` -> `modify`), else the
//           summary.
// Groups and endpoints are ordered by first appearance in the spec.

import fs from 'node:fs';
import yaml from 'js-yaml';

import {slugify} from '../navigation.mjs';
import {createResolver, exampleFor, markdownToHtml, plainSummary, toShape} from './schema.mjs';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'];

const REASONS = {
  400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable', 408: 'Request Timeout',
  409: 'Conflict', 410: 'Gone', 413: 'Content Too Large', 415: 'Unsupported Media Type',
  422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server',
  501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

const LANGUAGE_LABELS = {
  curl: 'cURL', python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
  go: 'Go', java: 'Java', ruby: 'Ruby', csharp: 'C#', php: 'PHP', swift: 'Swift', rust: 'Rust',
};
const PRISM_LANGUAGE = {curl: 'bash', csharp: 'csharp', javascript: 'javascript', typescript: 'typescript'};

/** Deep merge, as Fern applies overrides.yml: objects merge, arrays replace. */
export function deepMerge(base, override) {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const out = {...(base && typeof base === 'object' && !Array.isArray(base) ? base : {})};
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(out[key], value);
  return out;
}

export function loadOpenApi(specPath, overridesPath) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  if (!overridesPath || !fs.existsSync(overridesPath)) return spec;
  return deepMerge(spec, yaml.load(fs.readFileSync(overridesPath, 'utf8')));
}

/** "XPTransfersV2" -> "Xp Transfers V2", "auth" -> "Auth" (Fern's group titles). */
export function groupTitle(name) {
  return String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function methodName(op, tag) {
  if (op['x-fern-sdk-method-name']) return op['x-fern-sdk-method-name'];
  if (op.operationId) {
    const id = op.operationId;
    if (tag && id.toLowerCase().startsWith(tag.toLowerCase()) && id.length > tag.length) {
      return id.slice(tag.length).replace(/^[-_.\s]+/, '');
    }
    return id;
  }
  return op.summary;
}

function successLabel(method, status) {
  if (status === '201') return 'Created';
  if (status === '202') return 'Accepted';
  if (status === '204') return 'No Content';
  return {get: 'Retrieved', put: 'Updated', patch: 'Updated', delete: 'Deleted', post: 'Successful'}[method] ?? 'Successful';
}

const jsonBody = (container) => {
  const content = container?.content ?? {};
  const type = Object.keys(content).find((t) => t.includes('json')) ?? Object.keys(content)[0];
  return type ? {contentType: type, schema: content[type].schema, example: content[type].example} : undefined;
};

/** Fern-style cURL snippet for endpoints without authored samples. */
function generateCurl({method, url, query, headers, secured, authHeader, body}) {
  const lines = [];
  const hasQuery = query.length > 0;
  if (method === 'get' && hasQuery) lines.push(`curl -G ${url}`);
  else if (method === 'get') lines.push(`curl ${url}`);
  else lines.push(`curl -X ${method.toUpperCase()} ${url}`);
  if (secured) lines.push(`-H "${authHeader}: <apiKey>"`);
  for (const {name, value} of headers) lines.push(`-H "${name}: ${value}"`);
  if (body !== undefined) lines.push('-H "Content-Type: application/json"');
  for (const {name, value} of query) lines.push(`-d ${name}=${encodeURIComponent(String(value))}`);
  if (body !== undefined) lines.push(`-d '${JSON.stringify(body, null, 2)}'`);
  return lines.map((line, i) => (i === 0 ? line : `     ${line}`)).join(' \\\n');
}

/**
 * Build every endpoint of a spec.
 * @returns {Array<{groupSlug: string, groupTitle: string, methodSlug: string, data: object}>}
 */
export function buildEndpoints(spec, {apiName}) {
  const {deref} = createResolver(spec);
  const server = spec.servers?.[0]?.url ?? '';
  const serverPath = server.replace(/^[a-z]+:\/\/[^/]+/i, '');
  const schemes = spec.components?.securitySchemes ?? {};
  const endpoints = [];

  for (const [pathKey, pathItemRaw] of Object.entries(spec.paths ?? {})) {
    const pathItem = deref(pathItemRaw);
    for (const method of Object.keys(pathItem).filter((m) => HTTP_METHODS.includes(m))) {
      const op = pathItem[method];
      if (op['x-fern-ignore']) continue;
      const tag = op.tags?.[0];
      const groupNames = [].concat(op['x-fern-sdk-group-name'] ?? tag ?? 'Endpoints');
      const groupName = groupNames[groupNames.length - 1];
      const groupSlug = groupNames.map(slugify).join('/');
      const methodSlug = slugify(methodName(op, tag));
      const title = op.summary ?? op.operationId ?? `${method.toUpperCase()} ${pathKey}`;

      const params = [...(pathItem.parameters ?? []), ...(op.parameters ?? [])].map(deref);
      const toParam = (p) => ({
        name: p.name,
        required: Boolean(p.required || p.in === 'path'),
        shape: {
          ...toShape(p.schema ?? {type: 'string'}, deref),
          ...(p.description ? {description: markdownToHtml(p.description)} : {}),
        },
      });
      const pathParams = params.filter((p) => p.in === 'path').map(toParam);
      const queryParams = params.filter((p) => p.in === 'query').map(toParam);
      const headerParams = params.filter((p) => p.in === 'header').map(toParam);

      // The Authentication section lists the operation's own security; the
      // generated cURL also honours security inherited from the spec root
      // (as Fern's did).
      const security = op.security ?? [];
      const secured = security.some((req) => Object.keys(req).length > 0);
      const curlSecured = (op.security ?? spec.security ?? []).some((req) => Object.keys(req).length > 0);
      const schemeName = secured ? Object.keys(security.find((r) => Object.keys(r).length))[0] : undefined;
      const scheme = schemeName ? schemes[schemeName] : undefined;
      const authHeader = scheme?.type === 'apiKey' && scheme.in === 'header' ? scheme.name : 'Authorization';
      const auth = secured
        ? {
            name: authHeader,
            label: 'string',
            description:
              scheme?.description ??
              (scheme?.type === 'http' && scheme.scheme === 'bearer'
                ? 'Bearer authentication of the form `Bearer <token>`, where token is your auth token.'
                : 'API Key authentication via header'),
          }
        : undefined;

      const requestBodyRaw = op.requestBody ? deref(op.requestBody) : undefined;
      const body = jsonBody(requestBodyRaw);
      const requestBody = body
        ? {
            description: markdownToHtml(requestBodyRaw.description),
            contentType: body.contentType,
            required: Boolean(requestBodyRaw.required),
            shape: toShape(body.schema, deref),
          }
        : undefined;

      const responses = [];
      const errors = [];
      for (const [status, responseRaw] of Object.entries(op.responses ?? {})) {
        const response = deref(responseRaw);
        const content = jsonBody(response);
        const code = Number(status);
        if (code >= 200 && code < 300) {
          const example = content?.example ?? (content?.schema ? exampleFor(content.schema, deref) : undefined);
          responses.push({
            status,
            label: successLabel(method, status),
            description: markdownToHtml(response.description),
            shape: content?.schema ? toShape(content.schema, deref) : undefined,
            example,
          });
        } else if (code >= 400) {
          errors.push({
            status,
            name: `${REASONS[code] ?? 'Error'} Error`.replace('Error Error', 'Error'),
            description: markdownToHtml(response.description),
            shape: content?.schema ? toShape(content.schema, deref) : undefined,
          });
        }
      }

      // Paths defined only in overrides.yml have no responses; Fern still
      // showed a bare "200 Retrieved"/"200 Successful" panel.
      if (!responses.length) {
        responses.push({status: '200', label: successLabel(method, '200'), description: '', shape: undefined, example: undefined});
      }

      const displayPath = pathKey.replace(/\{([^}]+)\}/g, ':$1');
      const samples = [];
      for (const example of op['x-fern-examples'] ?? []) {
        for (const sample of example['code-samples'] ?? []) {
          const language = sample.sdk ?? sample.language ?? 'curl';
          samples.push({
            language,
            label: LANGUAGE_LABELS[language] ?? language,
            prism: PRISM_LANGUAGE[language] ?? language,
            code: sample.code.replace(/\s+$/, ''),
          });
        }
      }
      if (!samples.some((s) => s.language === 'curl')) {
        const exampleValue = (p) => {
          const value = exampleFor(p.schema ?? {type: 'string'}, deref);
          return p.example ?? (value === 'string' ? p.name : value);
        };
        const urlPath = pathKey.replace(/\{([^}]+)\}/g, (_, name) => {
          const p = params.find((x) => x.in === 'path' && x.name === name);
          return encodeURIComponent(String(p ? exampleValue(p) : name));
        });
        samples.unshift({
          language: 'curl',
          label: 'cURL',
          prism: 'bash',
          code: generateCurl({
            method,
            url: server + urlPath,
            query: params
              .filter((p) => p.in === 'query' && p.required)
              .map((p) => ({name: p.name, value: exampleFor(p.schema ?? {}, deref) ?? 'string'})),
            headers: params
              .filter((p) => p.in === 'header' && p.required)
              .map((p) => ({name: p.name, value: exampleFor(p.schema ?? {}, deref) ?? 'string'})),
            secured: curlSecured,
            authHeader,
            body: body ? (body.example ?? exampleFor(body.schema, deref, {requiredOnly: true})) : undefined,
          }),
        });
      }
      // cURL first, then authored samples in their original order.
      samples.sort((a, b) => Number(b.language === 'curl') - Number(a.language === 'curl'));

      endpoints.push({
        groupSlug,
        groupTitle: groupTitle(groupName),
        methodSlug,
        data: {
          api: apiName,
          method: method.toUpperCase(),
          path: pathKey,
          displayPath,
          server,
          serverPath,
          title,
          summary: plainSummary(op.description) ?? title,
          descriptionHtml: markdownToHtml(op.description),
          descriptionMarkdown: op.description ?? '',
          deprecated: Boolean(op.deprecated),
          auth,
          pathParams,
          queryParams,
          headerParams,
          requestBody,
          responses,
          errors,
          samples,
        },
      });
    }
  }
  return endpoints;
}
