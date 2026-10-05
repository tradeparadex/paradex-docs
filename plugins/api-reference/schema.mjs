// JSON Schema helpers shared by the REST (OpenAPI) and WebSocket (AsyncAPI)
// reference generators: $ref resolution, a render-friendly "shape" for the
// property tables, and example values built the way Fern built them.

import {micromark} from 'micromark';
import {gfm, gfmHtml} from 'micromark-extension-gfm';

// Elements a description may write as raw HTML. Anything else that looks
// like a tag (`<maker>`, `<apiKey>`) is text, so it is escaped instead of
// leaving an unclosed element in the page.
const HTML_TAGS = new Set(
  ('a abbr b blockquote br caption code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ' +
    'ol p pre q s small span strong sub summary sup table tbody td tfoot th thead tr u ul').split(' '),
);

function escapeUnknownTags(markdown) {
  // Leave code spans alone: `<T>` there is already literal text.
  return markdown
    .split(/(`+[^`]*`+)/g)
    .map((part, i) =>
      i % 2 ? part : part.replace(/<(\/?)([a-zA-Z][\w-]*)([^<>]*)>/g, (tag, slash, name, rest) =>
        HTML_TAGS.has(name.toLowerCase()) ? tag : `&lt;${slash}${name}${rest}&gt;`,
      ),
    )
    .join('');
}

// Descriptions come from the live API's spec (the daily sync-openapi pull
// request) and are rendered with dangerouslySetInnerHTML, so the HTML is
// sanitized after Markdown: only HTML_TAGS (plus what micromark's GFM output
// adds) stay elements, and they lose event handlers and URLs that can run
// script.
const OUTPUT_TAGS = new Set([...HTML_TAGS, 'input', 'section']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'srcset', 'cite', 'action', 'formaction', 'poster', 'background', 'xlink:href']);
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const NAMED_ENTITIES = {amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', colon: ':', tab: '\t', newline: '\n'};

/** True if a URL attribute value would run script (`javascript:`, also entity-encoded) or embed a `data:`/`vbscript:` document. */
function isUnsafeUrl(value) {
  const decoded = value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (entity, ref) => {
    if (ref[0] !== '#') return NAMED_ENTITIES[ref.toLowerCase()] ?? entity;
    const hex = ref[1] === 'x' || ref[1] === 'X';
    const code = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
  // Browsers ignore control characters and whitespace inside the scheme.
  return /(?:^|,)(?:javascript|vbscript|data):/i.test(decoded.replace(/[\u0000- \u007f]/g, ''));
}

export function sanitizeHtml(html) {
  return html.replace(/<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (tag, slash, name, rest) => {
    if (!OUTPUT_TAGS.has(name.toLowerCase())) return escapeHtml(tag);
    if (slash) return `</${name}>`;
    const attributes = [];
    for (const [, attribute, doubleQuoted, singleQuoted, unquoted] of rest.matchAll(ATTRIBUTE)) {
      const key = attribute.toLowerCase();
      const value = doubleQuoted ?? singleQuoted ?? unquoted;
      if (key.startsWith('on')) continue;
      if (URL_ATTRIBUTES.has(key) && value !== undefined && isUnsafeUrl(value)) continue;
      // Nothing tag-shaped stays raw inside a value: the page splits this
      // HTML at <pre><code> (src/components/api/schema.tsx), which must not
      // find one inside an attribute.
      const escaped = value?.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      attributes.push(value === undefined ? ` ${attribute}` : ` ${attribute}="${escaped}"`);
    }
    return `<${name}${attributes.join('')}${/\/\s*$/.test(rest) ? ' /' : ''}>`;
  });
}

const NO_TYPOGRAPHY = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style']);
const OPENS_QUOTE = /[\s([{—–/-]/;

/**
 * Curly quotes in the text of an HTML fragment (outside code), as Fern
 * typeset descriptions: "a" -> “a”, it's -> it’s.
 */
export function smartQuotes(html) {
  let prev = '';
  let skip = 0;
  return html.replace(/(<\/?([a-zA-Z][\w-]*)[^>]*>)|([^<]+)/g, (match, tag, name, text) => {
    if (tag) {
      if (NO_TYPOGRAPHY.has(name.toLowerCase())) {
        if (tag.startsWith('</')) skip = Math.max(0, skip - 1);
        else skip += 1;
        prev = 'x';
      }
      return tag;
    }
    if (skip) {
      prev = text.slice(-1);
      return text;
    }
    // remark-smartypants also turns "..." into an ellipsis.
    const decoded = text.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\.\.\./g, '…');
    let out = '';
    for (const ch of decoded) {
      const opening = prev === '' || OPENS_QUOTE.test(prev);
      if (ch === '"') out += opening ? '“' : '”';
      else if (ch === "'") out += opening ? '‘' : '’';
      else out += ch;
      prev = ch;
    }
    return out;
  });
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Fern printed a description made only of letters, digits, spaces and
 * `.,'"!?` as plain text (no paragraph, quotes left as typed) and ran
 * everything else through Markdown with typographic quotes.
 */
function isPlainText(text) {
  return /^[a-zA-Z0-9\s.,'"!?]*$/.test(text);
}

export function markdownToHtml(markdown) {
  if (!markdown) return '';
  const source = String(markdown).trim();
  if (isPlainText(source)) return escapeHtml(source);
  const html = micromark(escapeUnknownTags(source), {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  }).trim();
  return smartQuotes(withTableCards(withHeadingIds(sanitizeHtml(html))));
}

/**
 * Tables sit in the scrolling table card that MDX tables get
 * (src/theme/MDXComponents.tsx), as Fern rendered description tables.
 * Only complete tables are wrapped, so a stray tag adds no unmatched div.
 */
function withTableCards(html) {
  return html.replace(/<table\b[^>]*>(?:(?!<table\b)[\s\S])*?<\/table>/g, '<div class="fern-table">$&</div>');
}

/** Give headings the slug ids Fern gave them ("### TWAP" -> id="twap"). */
function withHeadingIds(html) {
  const used = new Map();
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const base = inner
      .replace(/<[^>]+>/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return `<h${level} id="${count ? `${base}-${count}` : base}">${inner}</h${level}>`;
  });
}

/** Plain-text first paragraph, for meta descriptions. */
export function plainSummary(markdown, max = 160) {
  if (!markdown) return undefined;
  const first = String(markdown).trim().split(/\n\s*\n/)[0];
  const text = first
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function createResolver(document) {
  const resolvePointer = (ref) => {
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref ${ref}`);
    return ref
      .slice(2)
      .split('/')
      .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce((node, key) => {
        if (node?.[key] === undefined) throw new Error(`Unresolved $ref ${ref}`);
        return node[key];
      }, document);
  };
  /** Follow $ref chains, merging sibling keys (OpenAPI 3.1 style). */
  const deref = (node) => {
    let current = node;
    const seen = new Set();
    while (current && typeof current === 'object' && current.$ref) {
      if (seen.has(current.$ref)) break;
      seen.add(current.$ref);
      const {$ref, ...rest} = current;
      current = {...resolvePointer($ref), ...rest};
    }
    return current;
  };
  return {resolvePointer, deref};
}

const refName = (ref) => ref.split('/').pop();

function mergeAllOf(schema, deref) {
  if (!schema.allOf) return schema;
  const merged = {...schema, allOf: undefined, properties: {}, required: []};
  for (const part of schema.allOf.map((p) => mergeAllOf(deref(p), deref))) {
    // A later part refines a property (e.g. narrows `items`) without
    // repeating its description; keep what earlier parts said.
    for (const [name, prop] of Object.entries(part.properties ?? {})) {
      merged.properties[name] = merged.properties[name] ? {...merged.properties[name], ...prop} : prop;
    }
    merged.required.push(...(part.required ?? []));
    for (const key of ['type', 'description', 'example', 'enum', 'items', 'additionalProperties']) {
      if (merged[key] === undefined && part[key] !== undefined) merged[key] = part[key];
    }
  }
  merged.properties = {...merged.properties, ...(schema.properties ?? {})};
  merged.required = [...new Set([...merged.required, ...(schema.required ?? [])])];
  if (!merged.type && Object.keys(merged.properties).length) merged.type = 'object';
  return merged;
}

function constraintsOf(schema) {
  const out = [];
  // Fern showed no array-length (minItems/maxItems) constraints.
  const {minLength, maxLength, minimum, maximum, exclusiveMinimum, exclusiveMaximum, pattern} = schema;
  if (minLength !== undefined && maxLength !== undefined) out.push(`${minLength}-${maxLength} characters`);
  else if (minLength !== undefined) out.push(`>=${minLength} character${minLength === 1 ? '' : 's'}`);
  else if (maxLength !== undefined) out.push(`<=${maxLength} characters`);
  if (minimum !== undefined && maximum !== undefined) out.push(`${minimum}-${maximum}`);
  else if (minimum !== undefined) out.push(`>=${minimum}`);
  else if (maximum !== undefined) out.push(`<=${maximum}`);
  if (typeof exclusiveMinimum === 'number') out.push(`>${exclusiveMinimum}`);
  if (typeof exclusiveMaximum === 'number') out.push(`<${exclusiveMaximum}`);
  if (pattern) out.push(`format: "${pattern}"`);
  return out;
}

function primitiveLabel(schema) {
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  if (type === 'integer') return schema.format === 'int64' ? 'long' : 'integer';
  if (type === 'number') return schema.format === 'float' ? 'double' : 'double';
  if (type === 'string') {
    if (schema.format === 'date-time') return 'datetime';
    if (schema.format === 'date') return 'date';
    if (schema.format === 'uuid') return 'UUID';
    if (schema.format === 'binary') return 'file';
    return 'string';
  }
  if (type === 'boolean') return 'boolean';
  return type ?? 'any';
}

const plural = (label) => {
  if (label === 'any') return 'any';
  // "list of lists of strings", as on Fern.
  if (label.startsWith('list of ')) return `lists of ${label.slice('list of '.length)}`;
  if (label.startsWith('map from ')) return `maps from ${label.slice('map from '.length)}`;
  if (label === 'UUID') return 'UUIDs';
  return label.endsWith('s') ? label : `${label}s`;
};

/**
 * Convert a JSON schema into the shape rendered by <SchemaProperties>.
 * Recursive references become {kind: 'circular'}.
 */
export function toShape(input, deref, stack = []) {
  if (input === undefined || input === null) return {kind: 'unknown', label: 'any'};
  const ref = input.$ref;
  if (ref && stack.includes(ref)) {
    return {kind: 'circular', label: 'object', name: refName(ref)};
  }
  const nextStack = ref ? [...stack, ref] : stack;
  const schema = mergeAllOf(deref(input), deref);
  const base = {
    description: markdownToHtml(schema.description),
    constraints: constraintsOf(schema),
    ...(schema.default !== undefined ? {default: schema.default} : {}),
    ...(schema.deprecated ? {deprecated: true} : {}),
    ...(ref ? {name: refName(ref)} : {}),
  };

  if (schema.enum) {
    return {...base, kind: 'enum', label: 'enum', values: schema.enum.filter((v) => v !== null).map(String)};
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (variants) {
    const shapes = variants.map((v) => toShape(v, deref, nextStack));
    const nonNull = shapes.filter((s) => s.label !== 'null');
    if (nonNull.length === 1) return {...nonNull[0], ...base, description: base.description || nonNull[0].description};
    return {...base, kind: 'union', label: 'union', variants: shapes};
  }
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  if (type === 'array' || schema.items) {
    const items = toShape(schema.items ?? {}, deref, nextStack);
    return {...base, kind: 'array', label: `list of ${plural(items.label)}`, items};
  }
  if (type === 'object' || schema.properties || schema.additionalProperties) {
    const props = schema.properties ?? {};
    if (!Object.keys(props).length && schema.additionalProperties) {
      const values =
        schema.additionalProperties === true
          ? {kind: 'unknown', label: 'any'}
          : toShape(schema.additionalProperties, deref, nextStack);
      return {...base, kind: 'map', label: `map from strings to ${plural(values.label)}`, mapValues: values};
    }
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(props).map(([name, prop]) => ({
      name,
      required: required.has(name),
      shape: toShape(prop, deref, nextStack),
    }));
    // Required properties first, as Fern lists them.
    properties.sort((a, b) => Number(b.required) - Number(a.required));
    return {...base, kind: 'object', label: 'object', properties};
  }
  return {...base, kind: 'primitive', label: primitiveLabel(schema)};
}

/**
 * Fern replaced example values that are not among an enum's values with the
 * enum's first value (e.g. a malformed `flags` example).
 */
function conformToEnum(schema, value, deref) {
  const first = (values) => values.find((v) => v !== null) ?? null;
  const items = schema.items ? mergeAllOf(deref(schema.items), deref) : undefined;
  if (Array.isArray(value) && items?.enum) return value.map((v) => (items.enum.includes(v) ? v : first(items.enum)));
  if (schema.enum && !schema.enum.includes(value)) return first(schema.enum);
  return value;
}

/**
 * Example value for a schema, preferring authored examples.
 *
 * `placeholders` reproduces the examples Fern generated for AsyncAPI
 * messages instead: authored examples are ignored, strings are the property
 * name, integers 1, enums their first value and arrays hold two items.
 */
export function exampleFor(input, deref, options = {}, stack = [], key = undefined) {
  const {requiredOnly = false, placeholders = false} = options;
  if (input === undefined || input === null) return undefined;
  const ref = input.$ref;
  if (ref && stack.includes(ref)) return {};
  const nextStack = ref ? [...stack, ref] : stack;
  const schema = mergeAllOf(deref(input), deref);
  if (!placeholders) {
    if (schema.example !== undefined) return conformToEnum(schema, schema.example, deref);
    if (schema.examples !== undefined) {
      return Array.isArray(schema.examples) ? schema.examples[0] : Object.values(schema.examples)[0]?.value;
    }
    if (schema.default !== undefined && schema.enum === undefined) return schema.default;
  }
  if (schema.enum) return schema.enum.find((v) => v !== null) ?? null;
  const variants = schema.oneOf ?? schema.anyOf;
  if (variants?.length) return exampleFor(variants[0], deref, options, nextStack, key);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  if (type === 'array' || schema.items) {
    const item = exampleFor(schema.items ?? {}, deref, options, nextStack, key);
    if (item === undefined) return [];
    return placeholders ? [item, item] : [item];
  }
  if (type === 'object' || schema.properties || schema.additionalProperties) {
    const props = schema.properties ?? {};
    // Maps have no example keys; Fern rendered them as `{}`.
    if (!Object.keys(props).length && schema.additionalProperties) return {};
    const required = new Set(schema.required ?? []);
    const out = {};
    for (const [name, prop] of Object.entries(props)) {
      if (requiredOnly && !required.has(name)) continue;
      const value = exampleFor(prop, deref, options, nextStack, name);
      if (value !== undefined) out[name] = value;
    }
    return out;
  }
  switch (type) {
    case 'integer':
      return 1;
    case 'number':
      return 1.1;
    case 'boolean':
      return true;
    case 'string':
      if (schema.format === 'date-time') return '2024-01-15T09:30:00Z';
      if (schema.format === 'date') return '2023-01-15';
      if (schema.format === 'uuid') return 'd5e9c84f-c2b2-4bf4-b4b0-7ffd7a9ffc32';
      return placeholders && key ? key : 'string';
    default:
      return undefined;
  }
}
