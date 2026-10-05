// JSON-RPC message checks and request-parameter validation, reproducing the
// MCP TypeScript SDK (the version Fern bundled) without zod.
//
// Transport level: every POSTed message must be a JSON-RPC request,
// notification, result or error (strict objects, jsonrpc "2.0"); anything
// else is a 400 "Parse error: Invalid JSON-RPC message".
//
// Handler level: the SDK parses each request with the method's zod v4 schema
// and, on failure, answers a JSON-RPC error -32603 whose message is the zod
// error (JSON array of issues). `validateParams` returns the same issues for
// the methods this server implements.

export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isRequestId = (v) => typeof v === 'string' || (typeof v === 'number' && Number.isSafeInteger(v));

function onlyKeys(obj, allowed) {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) return false;
  return true;
}

const RELATED_TASK = 'io.modelcontextprotocol/related-task';

/** RequestMeta: loose object; progressToken string|int; related-task {taskId: string}. */
function isValidMeta(meta) {
  if (!isPlainObject(meta)) return false;
  if (meta.progressToken !== undefined && !isRequestId(meta.progressToken)) return false;
  const related = meta[RELATED_TASK];
  if (related !== undefined && !(isPlainObject(related) && typeof related.taskId === 'string')) return false;
  return true;
}

/** Request/notification params: optional loose object with an optional valid _meta. */
function isValidParams(params) {
  if (params === undefined) return true;
  if (!isPlainObject(params)) return false;
  return params._meta === undefined || isValidMeta(params._meta);
}

export function isJsonRpcRequest(m) {
  return (
    isPlainObject(m) &&
    onlyKeys(m, ['jsonrpc', 'id', 'method', 'params']) &&
    m.jsonrpc === '2.0' &&
    isRequestId(m.id) &&
    typeof m.method === 'string' &&
    isValidParams(m.params)
  );
}

export function isJsonRpcNotification(m) {
  return (
    isPlainObject(m) &&
    onlyKeys(m, ['jsonrpc', 'method', 'params']) &&
    m.jsonrpc === '2.0' &&
    typeof m.method === 'string' &&
    isValidParams(m.params)
  );
}

export function isJsonRpcResult(m) {
  return (
    isPlainObject(m) &&
    onlyKeys(m, ['jsonrpc', 'id', 'result']) &&
    m.jsonrpc === '2.0' &&
    isRequestId(m.id) &&
    isPlainObject(m.result) &&
    (m.result._meta === undefined || isValidMeta(m.result._meta))
  );
}

export function isJsonRpcError(m) {
  return (
    isPlainObject(m) &&
    onlyKeys(m, ['jsonrpc', 'id', 'error']) &&
    m.jsonrpc === '2.0' &&
    (m.id === undefined || isRequestId(m.id)) &&
    isPlainObject(m.error) &&
    typeof m.error.code === 'number' &&
    Number.isSafeInteger(m.error.code) &&
    typeof m.error.message === 'string'
  );
}

export function isJsonRpcMessage(m) {
  return isJsonRpcRequest(m) || isJsonRpcNotification(m) || isJsonRpcResult(m) || isJsonRpcError(m);
}

// ---------------------------------------------------------------------------
// zod v4 style issues for request params. Fern's bundle has no zod locale
// loaded, so every issue message is the bare "Invalid input".

const INVALID_INPUT = 'Invalid input';

function typeIssue(expected, value, path) {
  return { expected, code: 'invalid_type', path, message: INVALID_INPUT };
}

function customIssue(path) {
  return { code: 'custom', path, message: INVALID_INPUT };
}

/** z.custom(v => v !== null && (typeof v === 'object' || typeof v === 'function')). */
const isObjectLike = (v) => v !== null && (typeof v === 'object' || typeof v === 'function');

/** An optional z.custom object-or-function field. */
function checkCustom(issues, obj, key, path) {
  if (obj[key] !== undefined && !isObjectLike(obj[key])) issues.push(customIssue([...path, key]));
}

const TYPE_CHECKS = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  object: isPlainObject,
  record: isPlainObject,
  array: Array.isArray,
};

/** Checks `obj[key]` against `type`; returns true when present and valid. */
function check(issues, obj, key, type, path, optional = true) {
  const value = obj[key];
  if (value === undefined && optional) return false;
  if (!TYPE_CHECKS[type](value)) {
    issues.push(typeIssue(type, value, [...path, key]));
    return false;
  }
  return true;
}

// Values of capability maps are "objects" (z.custom: object or function).
function checkObjectValues(issues, obj, path) {
  for (const key of Object.keys(obj)) checkCustom(issues, obj, key, path);
}

/**
 * z.intersection(z.object(shape), z.record(z.string(), z.unknown())): a value
 * that is not an object fails both sides (object, then record); an object
 * is checked against `shape`.
 */
function checkObjectAndRecord(issues, value, path, shape) {
  if (!isPlainObject(value)) {
    issues.push(typeIssue('object', value, path), typeIssue('record', value, path));
    return;
  }
  shape(value);
}

/**
 * Elicitation capability: {} means {form: {}}; `form` is an object with an
 * optional boolean `applyDefaults`, `url` an object or function.
 */
function checkElicitation(issues, value, path) {
  checkObjectAndRecord(issues, value, path, (elicitation) => {
    if (elicitation.form !== undefined) {
      checkObjectAndRecord(issues, elicitation.form, [...path, 'form'], (form) => {
        check(issues, form, 'applyDefaults', 'boolean', [...path, 'form']);
      });
    }
    checkCustom(issues, elicitation, 'url', path);
  });
}

/** Tasks capability: list, cancel and the request kinds are objects or functions. */
function checkTasks(issues, tasks, path) {
  checkCustom(issues, tasks, 'list', path);
  checkCustom(issues, tasks, 'cancel', path);
  if (!check(issues, tasks, 'requests', 'object', path)) return;
  const requests = [...path, 'requests'];
  if (check(issues, tasks.requests, 'sampling', 'object', requests)) checkCustom(issues, tasks.requests.sampling, 'createMessage', [...requests, 'sampling']);
  if (check(issues, tasks.requests, 'elicitation', 'object', requests)) checkCustom(issues, tasks.requests.elicitation, 'create', [...requests, 'elicitation']);
}

function checkCapabilities(issues, caps, path) {
  if (check(issues, caps, 'experimental', 'record', path)) checkObjectValues(issues, caps.experimental, [...path, 'experimental']);
  if (check(issues, caps, 'sampling', 'object', path)) {
    checkCustom(issues, caps.sampling, 'context', [...path, 'sampling']);
    checkCustom(issues, caps.sampling, 'tools', [...path, 'sampling']);
  }
  if (caps.elicitation !== undefined) checkElicitation(issues, caps.elicitation, [...path, 'elicitation']);
  if (check(issues, caps, 'roots', 'object', path)) check(issues, caps.roots, 'listChanged', 'boolean', [...path, 'roots']);
  if (check(issues, caps, 'tasks', 'object', path)) checkTasks(issues, caps.tasks, [...path, 'tasks']);
}

function checkImplementation(issues, info, path) {
  check(issues, info, 'name', 'string', path, false);
  check(issues, info, 'title', 'string', path);
  if (check(issues, info, 'icons', 'array', path)) {
    info.icons.forEach((icon, i) => {
      const iconPath = [...path, 'icons', i];
      if (!isPlainObject(icon)) {
        issues.push(typeIssue('object', icon, iconPath));
        return;
      }
      check(issues, icon, 'src', 'string', iconPath, false);
      check(issues, icon, 'mimeType', 'string', iconPath);
      if (check(issues, icon, 'sizes', 'array', iconPath)) {
        icon.sizes.forEach((size, j) => {
          if (typeof size !== 'string') issues.push(typeIssue('string', size, [...iconPath, 'sizes', j]));
        });
      }
      if (icon.theme !== undefined && icon.theme !== 'light' && icon.theme !== 'dark') {
        issues.push({ code: 'invalid_value', values: ['light', 'dark'], path: [...iconPath, 'theme'], message: INVALID_INPUT });
      }
    });
  }
  check(issues, info, 'version', 'string', path, false);
  check(issues, info, 'websiteUrl', 'string', path);
  check(issues, info, 'description', 'string', path);
}

/** InitializeRequest params (protocolVersion, capabilities, clientInfo). */
export function initializeParamsIssues(params) {
  const issues = [];
  if (!isPlainObject(params)) return [typeIssue('object', params, ['params'])];
  const path = ['params'];
  check(issues, params, 'protocolVersion', 'string', path, false);
  if (check(issues, params, 'capabilities', 'object', path, false)) {
    checkCapabilities(issues, params.capabilities, [...path, 'capabilities']);
  }
  if (check(issues, params, 'clientInfo', 'object', path, false)) {
    checkImplementation(issues, params.clientInfo, [...path, 'clientInfo']);
  }
  return issues;
}

/** True when the message satisfies the SDK's isInitializeRequest. */
export function isInitializeRequest(m) {
  return isPlainObject(m) && m.method === 'initialize' && initializeParamsIssues(m.params).length === 0;
}

/** Issues for the params of the methods this server registers, by method. */
export function validateParams(method, params) {
  switch (method) {
    case 'initialize':
      return initializeParamsIssues(params);
    case 'tools/list': {
      if (params === undefined) return [];
      const issues = [];
      check(issues, params, 'cursor', 'string', ['params']);
      return issues;
    }
    case 'tools/call': {
      if (!isPlainObject(params)) return [typeIssue('object', params, ['params'])];
      const issues = [];
      if (check(issues, params, 'task', 'object', ['params'])) check(issues, params.task, 'ttl', 'number', ['params', 'task']);
      check(issues, params, 'name', 'string', ['params'], false);
      check(issues, params, 'arguments', 'record', ['params']);
      return issues;
    }
    default:
      return [];
  }
}

/** The text of a zod error: JSON.stringify(issues, null, 2). */
export function zodErrorMessage(issues) {
  return JSON.stringify(issues, null, 2);
}

// ---------------------------------------------------------------------------
// zod v3 issues for tool arguments (Fern's tool shapes are zod v3 schemas;
// the SDK reports their ZodError.message inside the tool error text).

function v3Type(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isNaN(v) ? 'nan' : 'number';
  return typeof v;
}

function v3TypeIssue(expected, value, path) {
  const got = v3Type(value);
  return {
    code: 'invalid_type',
    expected,
    received: got,
    path,
    message: got === 'undefined' ? 'Required' : `Expected ${expected}, received ${got}`,
  };
}

/**
 * Validates tool arguments against a field list
 * [{name, type: 'string'|'integer', optional, min, max}], like
 * z.object(shape).safeParse (unknown keys are stripped, not rejected).
 * Returns {data} or {issues}.
 */
export function validateToolArguments(args, fields) {
  if (!isPlainObject(args)) return { issues: [v3TypeIssue('object', args, [])] };
  const issues = [];
  const data = {};
  for (const field of fields) {
    const value = args[field.name];
    const path = [field.name];
    if (value === undefined) {
      if (!field.optional) issues.push(v3TypeIssue(field.type === 'integer' ? 'number' : field.type, value, path));
      continue;
    }
    if (field.type === 'string') {
      if (typeof value !== 'string') issues.push(v3TypeIssue('string', value, path));
      else data[field.name] = value;
      continue;
    }
    // z.number().int().min(min).max(max): every failing check is reported.
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push(v3TypeIssue('number', value, path));
      continue;
    }
    const before = issues.length;
    if (!Number.isInteger(value)) {
      issues.push({
        code: 'invalid_type',
        expected: 'integer',
        received: 'float',
        message: 'Expected integer, received float',
        path,
      });
    }
    if (field.min !== undefined && value < field.min) {
      issues.push({
        code: 'too_small',
        minimum: field.min,
        type: 'number',
        inclusive: true,
        exact: false,
        message: `Number must be greater than or equal to ${field.min}`,
        path,
      });
    }
    if (field.max !== undefined && value > field.max) {
      issues.push({
        code: 'too_big',
        maximum: field.max,
        type: 'number',
        inclusive: true,
        exact: false,
        message: `Number must be less than or equal to ${field.max}`,
        path,
      });
    }
    if (issues.length === before) data[field.name] = value;
  }
  return issues.length > 0 ? { issues } : { data };
}
