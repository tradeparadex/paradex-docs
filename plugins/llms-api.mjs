// REST endpoint and WebSocket channel pages as Markdown, in the layout of
// Fern's docs.endpointDefinitionToMarkdown / websocketDefinitionToMarkdown
// and renderEndpointSchemaMarkdown (fern-docs bundle, _0sg90kl._.js).
//
// The schema is first converted to a small model of Fern's API definition
// (named types keyed by their component name, inline objects inside named
// types given Fern's generated names such as `ResponsesApiErrorData`), then
// rendered with the same rules: property lines, `## Types`, `## Examples`.
//
// MARKERS the edge layer relies on (do not change without updating edge/):
//
//   REST page (<url>.md), blocks joined by one blank line:
//     <preamble blockquote>
//     # <title>
//     <METHOD> <base URL><path with {param}>       (unfenced)
//     Content-Type: <type>                         (only with a request body)
//     <description>                                (optional)
//     Reference: https://docs.paradex.trade/<url>
//     ## Authentication / ## Servers / ## Request / ## Response /
//     ## Errors / ## Types                         <- schema sections
//     ## Examples                                  (only with 2xx examples)
//
//   ?excludeSpec=true drops every line from the first schema-section
//   heading after the `Reference:` line up to (not including) the line
//   `## Examples`, or to the end of the file. Schema sections only ever
//   follow the `Reference:` line; a description can contain its own `##`
//   headings, but those come before it.
//
//   Inside `## Examples` each example is a run of blocks; a paragraph that
//   is exactly `**Code Samples**` or `**SDK Code**` is followed by one or
//   more fenced code blocks whose info string is `<language>` or
//   `<language> <name>` (e.g. ```python, ```curl). ?lang= keeps a fence only
//   when its first info word maps to the requested SDK language (Fern's
//   SDK_LANGUAGE_MAPPINGS: node = typescript/javascript/node/js/ts,
//   python = python/py, go = go/golang, java, ruby, csharp, swift); curl
//   is dropped too, as in Fern. A marker paragraph left with no fences is
//   dropped with them. **SDK Code** never contains curl.
//   Fences are at least three backticks, longer when the code contains a
//   backtick run (Fern's markdownCodeBlock).
//
//   WebSocket page (<url>.md):
//     <preamble> / # <title> / GET <channel path> / <description> /
//     Reference: <url> / ## AsyncAPI Specification + ```yaml fence
//   ?excludeSpec=true drops the `## AsyncAPI Specification` heading and
//   its fence (everything from that heading to the end of the file).
//
//   Docs pages that embed <EndpointRequestSnippet> get a `### Request`
//   block whose fences follow the same `<language>[ <name>]` tagging (curl
//   is always kept there, as in Fern).

import yaml from 'js-yaml';
import camelCase from 'lodash/camelCase.js';
import upperFirst from 'lodash/upperFirst.js';

import {createResolver} from './api-reference/schema.mjs';
import {slugify} from './navigation.mjs';
import {markdownCodeBlock, markdownInlineCode, stripMdxFromMarkdown} from './llms-markdown.mjs';

const pascal = (value) => upperFirst(camelCase(String(value)));
const refName = (ref) => ref.split('/').pop();
const indent = (depth) => '  '.repeat(depth);
/** Fern's stripMdxFromMarkdown + whitespace collapsed (pR). */
const plain = (text) => stripMdxFromMarkdown(String(text)).replace(/\s+/g, ' ').trim();
const article = (label) => (/^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`);

// ---------------------------------------------------------------------------
// JSON Schema -> Fern-like type shapes.
//
// Shapes: {type:'id', id} | {type:'optional', shape, default} |
// {type:'nullable', shape} | {type:'primitive', value, default, format} |
// {type:'list', itemShape} | {type:'map', keyShape, valueShape} |
// {type:'enum', values} | {type:'object', properties} |
// {type:'undiscriminatedUnion', variants} | {type:'unknown'}

function createTypeModel(document) {
  const {deref} = createResolver(document);
  /** name -> {name, description, shape, deprecated} */
  const types = new Map();

  /** allOf parts merged into one object schema (property schemas kept raw). */
  function merge(schema, seen = new Set()) {
    if (!schema?.allOf) return schema;
    const merged = {...schema, allOf: undefined, properties: {}, required: []};
    for (const raw of schema.allOf) {
      if (raw?.$ref && seen.has(raw.$ref)) continue;
      const part = merge(deref(raw), raw?.$ref ? new Set([...seen, raw.$ref]) : seen);
      for (const [key, prop] of Object.entries(part.properties ?? {})) {
        merged.properties[key] = merged.properties[key] ? {...merged.properties[key], ...prop} : prop;
      }
      merged.required.push(...(part.required ?? []));
      for (const key of ['type', 'description', 'enum', 'items', 'additionalProperties']) {
        if (merged[key] === undefined && part[key] !== undefined) merged[key] = part[key];
      }
    }
    merged.properties = {...merged.properties, ...(schema.properties ?? {})};
    merged.required = [...new Set([...merged.required, ...(schema.required ?? [])])];
    if (!merged.type && Object.keys(merged.properties).length) merged.type = 'object';
    return merged;
  }

  function primitive(schema) {
    const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
    const base = {type: 'primitive', ...(schema.default !== undefined ? {default: schema.default} : {})};
    if (type === 'integer') return {...base, value: schema.format === 'int64' ? 'long' : 'integer'};
    if (type === 'number') return {...base, value: 'double'};
    if (type === 'boolean') return {...base, value: 'boolean'};
    if (type === 'string') {
      if (schema.format === 'date-time') return {...base, value: 'datetime'};
      if (schema.format === 'date') return {...base, value: 'date'};
      if (schema.format === 'uuid') return {...base, value: 'uuid'};
      if (schema.format === 'byte') return {...base, value: 'base64'};
      return {...base, value: 'string', ...(schema.pattern ? {regex: schema.pattern} : {}), ...(schema.minLength != null ? {minLength: schema.minLength} : {}), ...(schema.maxLength != null ? {maxLength: schema.maxLength} : {})};
    }
    return {type: 'unknown'};
  }

  /** Register a component schema as a named type (once). */
  function named(name, schemaFn) {
    if (!types.has(name)) {
      const entry = {name, description: undefined, shape: {type: 'unknown'}};
      types.set(name, entry);
      const schema = merge(schemaFn());
      entry.description = schema?.description;
      entry.deprecated = Boolean(schema?.deprecated);
      entry.shape = convertInner(schema, name);
    }
    return {type: 'id', id: name};
  }

  /** Property / item schema -> shape (names inline objects after `hint`). */
  function convert(raw, hint) {
    if (raw == null) return {type: 'unknown'};
    if (raw.$ref) return named(refName(raw.$ref), () => deref({$ref: raw.$ref}));
    if (raw.allOf?.length === 1 && raw.allOf[0]?.$ref && !raw.properties) {
      return named(refName(raw.allOf[0].$ref), () => deref({$ref: raw.allOf[0].$ref}));
    }
    const schema = merge(raw);
    const nullable = schema.nullable === true || (Array.isArray(schema.type) && schema.type.includes('null'));
    const hasProperties = Object.keys(schema.properties ?? {}).length > 0;
    const isObject = !schema.enum && !schema.oneOf && !schema.anyOf && (schema.type === 'object' || hasProperties) && (hasProperties || !schema.additionalProperties);
    let shape;
    if (isObject && hint) {
      let name = hint;
      for (let i = 2; types.has(name); i++) name = `${hint}${i}`;
      shape = named(name, () => schema);
    } else shape = convertInner(schema, hint);
    return nullable ? {type: 'nullable', shape} : shape;
  }

  /** Schema -> shape of the schema itself (no naming). */
  function convertInner(schema, ownName) {
    if (schema == null) return {type: 'unknown'};
    if (schema.enum) return {type: 'enum', values: schema.enum.filter((v) => v !== null).map(String), ...(schema.default !== undefined ? {default: schema.default} : {})};
    const variants = schema.oneOf ?? schema.anyOf;
    if (variants) {
      const nonNull = variants.filter((v) => deref(v)?.type !== 'null');
      if (nonNull.length === 1) return convert(nonNull[0], ownName);
      return {type: 'undiscriminatedUnion', variants: nonNull.map((v, i) => ({displayName: deref(v)?.title, shape: convert(v, ownName ? `${pascal(ownName)}${i}` : undefined)}))};
    }
    const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
    if (type === 'array' || schema.items) {
      return {type: 'list', itemShape: convert(schema.items ?? {}, ownName ? `${pascal(ownName)}Item` : undefined)};
    }
    if (type === 'object' || schema.properties || schema.additionalProperties) {
      const props = schema.properties ?? {};
      if (!Object.keys(props).length && schema.additionalProperties) {
        return {
          type: 'map',
          keyShape: {type: 'primitive', value: 'string'},
          valueShape: schema.additionalProperties === true ? {type: 'unknown'} : convert(schema.additionalProperties, ownName ? `${pascal(ownName)}Value` : undefined),
        };
      }
      const required = new Set(schema.required ?? []);
      return {
        type: 'object',
        properties: Object.entries(props).map(([key, rawProp]) => {
          const prop = rawProp?.$ref ? rawProp : merge(rawProp);
          const target = rawProp?.$ref ? deref(rawProp) : prop;
          let valueShape = convert(rawProp, ownName ? `${pascal(ownName)}${pascal(key)}` : undefined);
          const def = rawProp?.$ref ? undefined : prop?.default;
          if (!required.has(key)) valueShape = {type: 'optional', shape: valueShape, ...(def !== undefined ? {default: def} : {})};
          return {
            key,
            valueShape,
            description: rawProp?.$ref ? undefined : prop?.description,
            deprecated: Boolean(prop?.deprecated ?? target?.deprecated),
          };
        }),
      };
    }
    return primitive(schema);
  }

  // AsyncAPI message payloads, named as Fern's AsyncAPI importer names them:
  // the payload is the type `name` (AccountSubscribe), and every inline
  // object or enum inside it is a named type too, called after the channel,
  // the operation and the property path (ChannelsOrderCreateSubscribeOrder,
  // ChannelsOrderCreateSubscribeOrderSide; array items add `Items`). A $ref
  // to a component schema keeps the component's name.

  function uniqueName(hint) {
    let name = hint;
    for (let i = 2; types.has(name); i++) name = `${hint}${i}`;
    return name;
  }

  /** Registers `schema` as the named type `name`, its shape built by `shapeFn`. */
  function namedWith(name, schema, shapeFn) {
    const entry = {name, description: schema?.description, deprecated: Boolean(schema?.deprecated), shape: {type: 'unknown'}};
    types.set(name, entry);
    entry.shape = shapeFn(schema);
    return {type: 'id', id: name};
  }

  function convertPayloadValue(raw, hint) {
    if (raw == null) return {type: 'unknown'};
    if (raw.$ref || (raw.allOf?.length === 1 && raw.allOf[0]?.$ref && !raw.properties)) return convert(raw);
    const schema = merge(raw);
    const nullable = schema.nullable === true || (Array.isArray(schema.type) && schema.type.includes('null'));
    const hasProperties = Object.keys(schema.properties ?? {}).length > 0;
    let shape;
    if (schema.enum) shape = namedWith(uniqueName(hint), schema, (s) => convertInner(s));
    else if (!schema.oneOf && !schema.anyOf && (schema.type === 'object' || hasProperties) && (hasProperties || !schema.additionalProperties)) {
      shape = namedWith(uniqueName(hint), schema, (s) => payloadInner(s, hint));
    } else shape = payloadInner(schema, hint);
    return nullable ? {type: 'nullable', shape} : shape;
  }

  /** convertInner with Fern's AsyncAPI names for nested inline schemas. */
  function payloadInner(schema, prefix) {
    if (schema == null) return {type: 'unknown'};
    if (schema.enum || schema.oneOf || schema.anyOf) return convertInner(schema, prefix);
    const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
    if (type === 'array' || schema.items) return {type: 'list', itemShape: convertPayloadValue(schema.items ?? {}, `${prefix}Items`)};
    const props = schema.properties ?? {};
    if ((type === 'object' || schema.properties || schema.additionalProperties) && Object.keys(props).length > 0) {
      const required = new Set(schema.required ?? []);
      return {
        type: 'object',
        properties: Object.entries(props).map(([key, rawProp]) => {
          const prop = rawProp?.$ref ? rawProp : merge(rawProp);
          const target = rawProp?.$ref ? deref(rawProp) : prop;
          let valueShape = convertPayloadValue(rawProp, `${prefix}${pascal(key)}`);
          const def = rawProp?.$ref ? undefined : prop?.default;
          if (!required.has(key)) valueShape = {type: 'optional', shape: valueShape, ...(def !== undefined ? {default: def} : {})};
          return {key, valueShape, description: rawProp?.$ref ? undefined : prop?.description, deprecated: Boolean(prop?.deprecated ?? target?.deprecated)};
        }),
      };
    }
    return convertInner(schema, prefix);
  }

  /**
   * A message payload (inline or $ref) as the named type `name`, nested
   * inline schemas named `Channels<name><Property>...`.
   */
  function convertPayload(raw, name) {
    const schema = merge(raw?.$ref ? deref(raw) : raw);
    return namedWith(uniqueName(name), schema, (s) => payloadInner(s, `Channels${name}`));
  }

  /**
   * A channel parameter's schema: an inline enum is the named type `key`
   * (Fern's `feed_type`, `refresh_rate`), shared by every channel that uses
   * the same parameter.
   */
  function convertParameter(raw, key) {
    const schema = merge(raw?.$ref ? deref(raw) : raw ?? {type: 'string'});
    if (!schema?.enum) return convert(raw ?? {type: 'string'});
    const existing = types.get(key);
    if (existing?.source === schema) return {type: 'id', id: key};
    const shape = namedWith(uniqueName(key), {...schema, description: undefined}, (s) => convertInner(s));
    types.get(shape.id).source = schema;
    return shape;
  }

  return {types, convert, convertPayload, convertParameter, deref, merge};
}

// ---------------------------------------------------------------------------
// Fern's renderEndpointSchemaMarkdown on that model.

function createRenderer(types) {
  let collector;

  function unwrap(shape) {
    let current = shape;
    let isOptional = false;
    let isNullable = false;
    let def;
    const descriptions = [];
    const visitedTypeIds = [];
    for (let guard = 0; guard < 50; guard++) {
      if (current?.type === 'id') {
        visitedTypeIds.push(current.id);
        const t = types.get(current.id);
        if (!t) {
          current = {type: 'unknown'};
          break;
        }
        if (t.description) descriptions.push(t.description);
        current = t.shape;
      } else if (current?.type === 'optional') {
        isOptional = true;
        if (current.default !== undefined && def === undefined) def = current.default;
        current = current.shape;
      } else if (current?.type === 'nullable') {
        isNullable = true;
        current = current.shape;
      } else break;
    }
    if (def === undefined && current?.default !== undefined) def = current.default;
    return {shape: current ?? {type: 'unknown'}, isOptional, isNullable, default: def, descriptions, visitedTypeIds};
  }

  /** The named object/union a reference resolves to (pk). */
  function namedObject(unwrapped) {
    const t = unwrapped.shape.type;
    if (t !== 'object' && t !== 'undiscriminatedUnion' && t !== 'discriminatedUnion') return undefined;
    let found;
    for (const id of unwrapped.visitedTypeIds) if (types.has(id)) found = id;
    return found;
  }

  const displayName = (id) => types.get(id)?.name ?? 'object';

  function collect(unwrapped) {
    const id = namedObject(unwrapped);
    if (id == null) return false;
    collector?.add(id);
    return true;
  }

  const seenWith = (seen, unwrapped) => new Set([...seen, ...unwrapped.visitedTypeIds]);
  const isCircular = (seen, unwrapped) => unwrapped.visitedTypeIds.some((id) => seen.has(id));

  function label(shape, seen = new Set()) {
    const u = unwrap(shape);
    const visited = new Set(seen);
    for (const id of u.visitedTypeIds) {
      if (visited.has(id)) return displayName(id);
      visited.add(id);
    }
    const id = namedObject(u);
    if (id != null) return displayName(id);
    const s = u.shape;
    switch (s.type) {
      case 'primitive':
        return {string: 'string', integer: 'integer', long: 'long', double: 'double', boolean: 'boolean', datetime: 'datetime', uuid: 'UUID', base64: 'base64 string', date: 'date'}[s.value] ?? 'unknown';
      case 'object':
      case 'discriminatedUnion':
        return 'object';
      case 'undiscriminatedUnion':
        return s.variants.map((v) => label(v.shape, visited)).join(' or ') || 'object';
      case 'enum':
        return 'enum';
      case 'list':
        return `list of ${label(s.itemShape, visited)}`;
      case 'map':
        return `map from ${label(s.keyShape, visited)} to ${label(s.valueShape, visited)}`;
      case 'unknown':
        return 'any';
      default:
        return 'unknown';
    }
  }

  const sortProperties = (properties) =>
    [...properties].sort((a, b) => Number(unwrap(a.valueShape).isOptional) - Number(unwrap(b.valueShape).isOptional) || Number(a.deprecated) - Number(b.deprecated));

  function propertyLines(prop, depth, seen) {
    const u = unwrap(prop.valueShape);
    const parts = [label(prop.valueShape), u.isOptional ? 'optional' : 'required'];
    if (u.isNullable) parts.push('nullable');
    if (u.default != null) parts.push(`default: ${typeof u.default === 'string' ? u.default : JSON.stringify(u.default)}`);
    if (prop.deprecated) parts.push('deprecated');
    const description = prop.description ?? u.descriptions[0];
    const suffix = typeof description === 'string' && description.trim().length > 0 ? ` — ${plain(description)}` : '';
    const lines = [`${indent(depth)}- ${markdownInlineCode(prop.key)} (${parts.join(', ')})${suffix}`];
    if (!collect(u) && !isCircular(seen, u)) lines.push(...shapeLines(u.shape, depth + 1, seenWith(seen, u)));
    return lines;
  }

  function shapeLines(shape, depth, seen) {
    if (depth > 6) return [];
    switch (shape.type) {
      case 'object':
        return sortProperties(shape.properties).flatMap((p) => propertyLines(p, depth, seen));
      case 'undiscriminatedUnion':
        return shape.variants.flatMap((variant) => {
          const u = unwrap(variant.shape);
          if (u.shape.type !== 'object' || collect(u) || isCircular(seen, u)) return [];
          return [`${indent(depth)}- ${variant.displayName ?? label(variant.shape)}`, ...shapeLines(u.shape, depth + 1, seenWith(seen, u))];
        });
      case 'enum':
        return shape.values.length === 0 ? [] : [`${indent(depth)}- Allowed values: ${shape.values.map(markdownInlineCode).join(', ')}`];
      case 'list':
      case 'map': {
        const u = unwrap(shape.type === 'list' ? shape.itemShape : shape.valueShape);
        if (collect(u) || isCircular(seen, u)) return [];
        return shapeLines(u.shape, depth, seenWith(seen, u));
      }
      default:
        return [];
    }
  }

  const propertiesLines = (properties, seen = new Set()) => sortProperties(properties).flatMap((p) => propertyLines(p, 0, seen));
  /** Path, query and header parameters: source order (Fern's pz, no sort). */
  const parameterLines = (properties) => properties.flatMap((p) => propertyLines(p, 0, new Set()));

  /** Lines for a body or error shape (pH / p$). */
  function bodyLines(shape) {
    if (shape == null) return [];
    if (shape.type === 'object') return propertiesLines(shape.properties);
    const u = unwrap(shape);
    if (u.shape.type === 'object') return propertiesLines(u.shape.properties, seenWith(new Set(), u));
    return [`- ${markdownInlineCode(label(shape))}`, ...shapeLines(u.shape, 1, seenWith(new Set(), u))];
  }

  function typesSection(ids) {
    const out = [];
    const queue = [...ids];
    const done = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (id == null || done.has(id)) continue;
      done.add(id);
      const t = types.get(id);
      if (t == null) continue;
      const previous = collector;
      collector = new Set();
      let lines;
      try {
        const u = unwrap(t.shape);
        lines = shapeLines(u.shape, 0, seenWith(new Set([id]), u));
      } finally {
        for (const next of collector) if (!done.has(next)) queue.push(next);
        collector = previous;
      }
      const body = [typeof t.description === 'string' && t.description.trim().length > 0 ? plain(t.description) : undefined, lines.length > 0 ? lines.join('\n') : undefined]
        .filter((x) => x != null)
        .join('\n\n');
      const heading = `### ${t.name}`;
      out.push(body.length > 0 ? `${heading}\n\n${body}` : heading);
    }
    return out.length > 0 ? ['## Types', ...out] : [];
  }

  /** Run `fn` collecting the named types it references. */
  function withCollector(fn) {
    const previous = collector;
    collector = new Set();
    try {
      return {result: fn(), typeIds: collector};
    } finally {
      collector = previous;
    }
  }

  return {label, bodyLines, propertiesLines, parameterLines, typesSection, withCollector, unwrap};
}

const section = (heading, lines) => (lines.length === 0 ? undefined : [heading, lines.join('\n')].join('\n\n'));

// ---------------------------------------------------------------------------

/** Key order of the snippets Fern generated for every endpoint example. */
const SNIPPET_ORDER = ['curl', 'python', 'javascript', 'go', 'ruby', 'java', 'php', 'csharp', 'swift'];

/** Fern's SDK language groups for ?lang= (parseSdkLanguageFilter). */
export const SDK_LANGUAGE_MAPPINGS = {
  node: ['typescript', 'javascript', 'node', 'js', 'ts'],
  python: ['python', 'py'],
  java: ['java'],
  ruby: ['ruby'],
  go: ['go', 'golang'],
  csharp: ['csharp'],
  swift: ['swift'],
};

/**
 * @param {object} options
 * @param {Map<string, {type: string, document: object}>} options.specs  site.api.specs
 */
export function createApiMarkdown({specs}) {
  const models = new Map();
  const modelFor = (apiName) => {
    if (!models.has(apiName)) {
      const spec = specs.get(apiName);
      const model = createTypeModel(spec.document);
      models.set(apiName, {spec, model, renderer: createRenderer(model.types)});
    }
    return models.get(apiName);
  };

  function operationOf(page) {
    const {spec} = modelFor(page.data.api);
    const pathItem = spec.document.paths?.[page.data.path] ?? {};
    return pathItem[page.data.method.toLowerCase()] ?? {};
  }

  /**
   * Authored x-fern-examples code samples, in order and verbatim (Fern keeps
   * the YAML block's final newline). `sdk:` entries are SDK snippets that
   * replace the generated ones; `language:` entries are Fern's custom
   * "Code Samples".
   */
  function authoredSamples(op, kind) {
    const out = [];
    for (const example of op['x-fern-examples'] ?? []) {
      for (const sample of example['code-samples'] ?? []) {
        const isSdk = sample.sdk != null || sample.language == null;
        if ((kind === 'sdk') !== isSdk) continue;
        out.push({language: sample.sdk ?? sample.language ?? 'curl', name: sample.name, code: String(sample.code)});
      }
    }
    return out;
  }

  /**
   * Fern's example `snippets` map, flattened in key order: the authored SDK
   * samples first (their own order), then the generated snippet of every
   * other language in Fern's order (curl, python, javascript, go, ruby, java,
   * php, csharp, swift). curl is included; the endpoint page drops it.
   */
  function exampleSnippets(page, op) {
    const byLanguage = new Map();
    for (const sample of authoredSamples(op, 'sdk')) {
      if (!byLanguage.has(sample.language)) byLanguage.set(sample.language, []);
      byLanguage.get(sample.language).push(sample);
    }
    const generated = page.data.samples ?? [];
    const rank = (language) => (SNIPPET_ORDER.includes(language) ? SNIPPET_ORDER.indexOf(language) : SNIPPET_ORDER.length);
    for (const sample of [...generated].sort((a, b) => rank(a.language) - rank(b.language))) {
      if (byLanguage.has(sample.language)) continue;
      byLanguage.set(sample.language, [{language: sample.language, code: sample.code}]);
    }
    return [...byLanguage.values()].flat();
  }

  const fence = (sample) => markdownCodeBlock(sample.code, `${sample.language}${sample.name != null ? ` ${sample.name}` : ''}`);

  /** The model of one REST endpoint: parameters, body, responses, errors. */
  function endpointModel(page) {
    const {spec, model} = modelFor(page.data.api);
    const op = operationOf(page);
    const pathItem = spec.document.paths?.[page.data.path] ?? {};
    const params = [...(pathItem.parameters ?? []), ...(op.parameters ?? [])].map((p) => model.deref(p));
    const toProperty = (p) => {
      let valueShape = model.convert(p.schema ?? {type: 'string'});
      const required = Boolean(p.required || p.in === 'path');
      if (!required) valueShape = {type: 'optional', shape: valueShape, ...(p.schema?.default !== undefined ? {default: p.schema.default} : {})};
      return {key: p.name, valueShape, description: p.description, deprecated: Boolean(p.deprecated)};
    };
    const requestBodyRaw = op.requestBody ? model.deref(op.requestBody) : undefined;
    const jsonContent = (container) => {
      const content = container?.content ?? {};
      const type = Object.keys(content).find((t) => t.includes('json')) ?? Object.keys(content)[0];
      return type ? {contentType: type, schema: content[type].schema} : undefined;
    };
    const inlineBody = (schema) => {
      if (schema == null) return undefined;
      if (schema.$ref) return model.convert(schema);
      // Inline bodies stay inline objects (Fern's HttpRequestBodyShape "object").
      const merged = model.merge(schema);
      if (merged.type === 'object' || merged.properties) return model.convert({...merged, nullable: false});
      return model.convert(merged);
    };
    const request = jsonContent(requestBodyRaw);
    const responses = [];
    const errors = [];
    for (const [status, raw] of Object.entries(op.responses ?? {})) {
      const response = model.deref(raw);
      const code = Number(status);
      const content = jsonContent(response);
      if (code >= 200 && code < 300) {
        if (code === 204) continue;
        responses.push({statusCode: code, description: response.description, body: content?.contentType.includes('json') ? inlineBody(content.schema) : undefined});
      } else if (code >= 400) {
        if (content && !content.contentType.includes('json')) continue;
        const known = page.data.errors?.find((e) => String(e.status) === status);
        errors.push({statusCode: code, name: known?.name, description: response.description, shape: content ? inlineBody(content.schema) : undefined});
      }
    }
    const securitySchemes = spec.document.components?.securitySchemes ?? {};
    const auth = [...new Set((op.security ?? []).flatMap((req) => Object.keys(req)))].map((name) => securitySchemes[name]).filter(Boolean);
    return {
      op,
      pathParameters: params.filter((p) => p.in === 'path').map(toProperty),
      queryParameters: params.filter((p) => p.in === 'query').map(toProperty),
      headers: params.filter((p) => p.in === 'header').map(toProperty),
      request: request ? {contentType: request.contentType, body: inlineBody(request.schema)} : undefined,
      responses,
      errors,
      auth,
    };
  }

  function authLines(auth) {
    const describe = (labelText, scheme, fallback) =>
      typeof scheme.description === 'string' && scheme.description.trim().length > 0 ? `${labelText} — ${plain(scheme.description)}` : fallback != null ? `${labelText} — ${fallback}` : labelText;
    const lines = auth.map((scheme) => {
      if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        return describe('`Authorization` header (bearer token, required)', scheme, 'Bearer authentication of the form `Bearer <token>`, where token is your auth token.');
      }
      if (scheme.type === 'http' && scheme.scheme === 'basic') {
        return describe('`Authorization` header (basic auth, required)', scheme, 'Basic authentication of the form `Basic <base64(username:password)>`.');
      }
      if (scheme.type === 'apiKey' && scheme.in === 'header') {
        return describe(`${markdownInlineCode(scheme.name)} header (required)`, scheme, 'API Key authentication via header');
      }
      if (scheme.type === 'oauth2') return 'OAuth2 — send the obtained token as `Authorization: Bearer <token>`';
      return 'Authentication required';
    });
    return lines.length === 0 ? [] : ['## Authentication', lines.map((l) => `- ${l}`).join('\n')];
  }

  /** Schema sections (Authentication ... Types) of a REST endpoint. */
  function schemaSections(page, m) {
    const {renderer} = modelFor(page.data.api);
    const {result, typeIds} = renderer.withCollector(() => {
      const out = [...authLines(m.auth)];
      // ## Servers only with two or more environments; each spec has one.
      const body = m.request?.body;
      const bodyLines = body ? renderer.bodyLines(body) : [];
      const preamble = body ? `This endpoint expects ${article(renderer.label(body))}.` : undefined;
      const requestParts = [
        section('### Path parameters', renderer.parameterLines(m.pathParameters)),
        section('### Query parameters', renderer.parameterLines(m.queryParameters)),
        section('### Headers', renderer.parameterLines(m.headers)),
        bodyLines.length > 0 ? section(m.request?.contentType ? `### Body (${m.request.contentType})` : '### Body', preamble != null ? [preamble, '', ...bodyLines] : bodyLines) : undefined,
      ].filter((x) => x != null);
      if (requestParts.length > 0) out.push('## Request', ...requestParts);
      const responses = m.responses
        .map((r) => {
          const lines = renderer.bodyLines(r.body);
          const text = [typeof r.description === 'string' && r.description.trim().length > 0 ? plain(r.description) : undefined, lines.length > 0 ? lines.join('\n') : undefined]
            .filter((x) => x != null)
            .join('\n\n');
          return text.length > 0 ? [`### ${r.statusCode}`, text].join('\n\n') : undefined;
        })
        .filter((x) => x != null);
      if (responses.length > 0) out.push('## Response', ...responses);
      const errors = m.errors.map((e) => {
        const heading = `### ${e.statusCode}${e.name ? ` ${e.name}` : ''}`;
        const lines = e.shape ? renderer.bodyLines(e.shape) : [];
        const text = [typeof e.description === 'string' && e.description.trim().length > 0 ? plain(e.description) : undefined, lines.length > 0 ? lines.join('\n') : undefined]
          .filter((x) => x != null)
          .join('\n\n');
        return text.length > 0 ? [heading, text].join('\n\n') : heading;
      });
      if (errors.length > 0) out.push('## Errors', ...errors);
      return out;
    });
    return [...result, ...renderer.typesSection(typeIds)];
  }

  function examples(page, m) {
    const response = page.data.responses?.[0];
    const status = Number(response?.status ?? 200);
    if (!(status >= 200 && status < 300)) return [];
    const parts = [];
    const requestBody = page.data.example?.body;
    if (requestBody !== undefined) parts.push('**Request**', markdownCodeBlock(JSON.stringify(requestBody, null, 2), 'json'));
    const responseModel = m.responses.find((r) => r.statusCode === status);
    // A 2xx other than 204 always has an example body in Fern; one without a
    // JSON body (no content, or the referral QR code's image/png) shows `{}`.
    if (responseModel != null && response?.example !== undefined) {
      parts.push('**Response**', markdownCodeBlock(JSON.stringify(response.example, null, 2), 'json'));
    }
    const custom = authoredSamples(m.op, 'custom');
    if (custom.length > 0) parts.push('**Code Samples**', custom.map(fence).join('\n\n'));
    const sdk = exampleSnippets(page, m.op).filter((s) => s.language !== 'curl');
    if (sdk.length > 0) parts.push('**SDK Code**', sdk.map(fence).join('\n\n'));
    const filtered = parts.filter((p) => p.trim().length > 0);
    return filtered.length > 0 ? [filtered.join('\n\n')] : [];
  }

  /** A REST endpoint page as Markdown, without the preamble. */
  function endpointMarkdown(page, {referenceUrl}) {
    const m = endpointModel(page);
    const {data} = page;
    const head = [`${data.method} ${data.server}${data.path}`, m.request ? `Content-Type: ${m.request.contentType}` : undefined].filter((x) => x != null).join('\n');
    const exampleBlocks = examples(page, m);
    return [
      `# ${data.title}`,
      head,
      typeof m.op.description === 'string' ? stripMdxFromMarkdown(m.op.description) : undefined,
      `Reference: ${referenceUrl}`,
      ...schemaSections(page, m),
      exampleBlocks.length > 0 ? '## Examples' : undefined,
      ...exampleBlocks,
    ]
      .filter((x) => x != null)
      .join('\n\n');
  }

  // -------------------------------------------------------------------------
  // WebSocket channels: Fern's AsyncApiYamlFormatter on the channel.

  function channelOf(page) {
    const {spec} = modelFor(page.data.api);
    const channels = spec.document.channels ?? {};
    const address = Object.keys(channels).find((a) => (a.startsWith('/') ? a : `/${a}`) === page.data.path);
    return {address, channel: address ? spec.document.channels[address] : {}};
  }

  /** Fern's convertTypeShapeToSchema for the YAML block. */
  function toJsonSchema(shape, ctx) {
    if (shape == null) return {};
    switch (shape.type) {
      case 'primitive': {
        switch (shape.value) {
          case 'string': {
            const out = {type: 'string'};
            if (shape.regex != null) out.pattern = shape.regex;
            if (shape.minLength != null) out.minLength = shape.minLength;
            if (shape.maxLength != null) out.maxLength = shape.maxLength;
            if (shape.default !== undefined) out.default = shape.default;
            return out;
          }
          case 'integer':
            return {type: 'integer', ...(shape.default !== undefined ? {default: shape.default} : {})};
          case 'double':
            return {type: 'number', format: 'double', ...(shape.default !== undefined ? {default: shape.default} : {})};
          case 'long':
            return {type: 'integer', format: 'int64', ...(shape.default !== undefined ? {default: shape.default} : {})};
          case 'boolean':
            return {type: 'boolean', ...(shape.default !== undefined ? {default: shape.default} : {})};
          case 'date':
            return {type: 'string', format: 'date'};
          case 'datetime':
            return {type: 'string', format: 'date-time'};
          case 'uuid':
            return {type: 'string', format: 'uuid'};
          case 'base64':
            return {type: 'string', format: 'base64'};
          default:
            return {type: 'string'};
        }
      }
      case 'object': {
        const properties = {};
        const required = [];
        for (const prop of shape.properties) {
          let schema = toJsonSchema(prop.valueShape, ctx);
          if (prop.description || prop.deprecated) {
            schema = {...schema};
            if (prop.description) schema.description = prop.description;
            if (prop.deprecated) schema.deprecated = true;
          }
          properties[prop.key] = schema;
          if (prop.valueShape.type !== 'optional') required.push(prop.key);
        }
        const out = {type: 'object', properties};
        if (required.length > 0) out.required = [...new Set(required)];
        return out;
      }
      case 'list':
        return {type: 'array', items: toJsonSchema(shape.itemShape, ctx)};
      case 'map':
        return {type: 'object', additionalProperties: toJsonSchema(shape.valueShape, ctx)};
      case 'optional': {
        const inner = toJsonSchema(shape.shape, ctx);
        return shape.default !== undefined ? {...inner, default: shape.default} : inner;
      }
      case 'nullable': {
        const inner = toJsonSchema(shape.shape, ctx);
        if (inner.type && typeof inner.type === 'string') return {...inner, type: [inner.type, 'null']};
        return {oneOf: [inner, {type: 'null'}]};
      }
      case 'enum':
        return {type: 'string', enum: shape.values, ...(shape.default !== undefined ? {default: shape.default} : {})};
      case 'undiscriminatedUnion':
        return shape.variants.length > 0 ? {oneOf: shape.variants.map((v) => toJsonSchema(v.shape, ctx))} : {};
      case 'id': {
        const key = shape.id.replace(/[^A-Za-z0-9._-]/g, '_');
        const ref = {$ref: `#/components/schemas/${key}`};
        const t = ctx.types.get(shape.id);
        if (!t) return {description: `Reference to ${shape.id}`};
        if (ctx.visited.has(shape.id)) return ref;
        ctx.visited.add(shape.id);
        if (!ctx.components[key]) {
          const schema = toJsonSchema(t.shape, ctx);
          if (t.description && !schema.description) schema.description = t.description;
          if (t.name) schema.title = t.name;
          if (t.deprecated) schema.deprecated = true;
          ctx.components[key] = schema;
        }
        return ref;
      }
      case 'unknown':
        return {description: 'Any type'};
      default:
        return {};
    }
  }

  /** Payload shape per channel message, converted once (names are unique per API). */
  const payloadShapes = new Map();

  function asyncApiYaml(page) {
    const {spec, model} = modelFor(page.data.api);
    const {address, channel} = channelOf(page);
    const bare = String(address ?? page.data.path).replace(/^\//, '');
    const camel = camelCase(bare);
    const id = `subpackage_${camel}.${camel}`;
    const operationId = slugify(bare);
    const ctx = {types: model.types, components: {}, visited: new Set()};
    const description = typeof channel.description === 'string' ? channel.description : undefined;
    const doc = {asyncapi: '2.6.0', info: {title: page.data.title ?? 'WebSocket', version: id, description}, channels: {}};
    const servers = {};
    for (const [envId, server] of Object.entries(spec.document.servers ?? {})) {
      let url;
      try {
        const parsed = new URL(server.url);
        if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
        else if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
        if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') url = parsed.toString();
      } catch {
        url = undefined;
      }
      if (!url) continue;
      servers[envId] = {url, protocol: url.startsWith('wss:') ? 'wss' : 'ws'};
      if (Object.keys(servers).length === 1) servers[envId]['x-default'] = true;
    }
    if (Object.keys(servers).length > 0) doc.servers = servers;

    const ch = {description};
    const parameters = Object.entries(channel.parameters ?? {}).map(([key, raw]) => ({key, param: model.deref(raw)}));
    if (parameters.length > 0) {
      ch.parameters = {};
      for (const {key, param} of parameters) {
        ch.parameters[key] = {description: param.description ?? undefined, schema: toJsonSchema(model.convertParameter(param.schema, key), ctx)};
      }
    }
    const messagesFor = (kind) => {
      const op = channel[kind];
      if (!op) return [];
      const message = model.deref(op.message ?? {});
      const variants = message.oneOf ? message.oneOf.map((m) => model.deref(m)) : [message];
      return variants.map((m, i) => {
        const raw = message.oneOf ? message.oneOf[i] : op.message;
        const payload = m.payload ?? (raw?.$ref ? model.deref(raw).payload : undefined);
        // Fern names every message payload after the channel and the
        // operation (AccountSubscribe, BboMarketSymbolSubscribe), whether the
        // source payload is inline or a $ref to a component schema.
        const key = `${address}|${kind}|${i}`;
        if (payload && !payloadShapes.has(key)) {
          payloadShapes.set(key, model.convertPayload(payload, `${pascal(camel)}${kind === 'subscribe' ? 'Subscribe' : 'Publish'}`));
        }
        const body = payload ? payloadShapes.get(key) : undefined;
        // Fern's message has no description of its own: the message-level
        // one is dropped (verified on the account and bbo channels).
        const description = op.description;
        return {type: kind, displayName: kind, description: typeof description === 'string' ? description : undefined, body};
      });
    };
    const operation = (messages, origin, opSuffix, fallbackSummary) => {
      if (messages.length === 0) return;
      if (messages.length === 1) {
        const [n] = messages;
        ch[opSuffix] = {
          operationId: `${operationId || id}-${opSuffix}`,
          summary: n.displayName || fallbackSummary,
          description: n.description,
          message: {name: n.type, title: n.displayName ?? undefined, description: n.description, payload: n.body ? toJsonSchema(n.body, ctx) : undefined},
        };
        return;
      }
      doc.components ??= {};
      doc.components.messages ??= {};
      messages.forEach((n, i) => {
        doc.components.messages[`${id}-${origin}-${i}${n.type ? `-${n.type}` : ''}`] = {
          name: n.type,
          title: n.displayName ?? undefined,
          description: n.description,
          payload: n.body ? toJsonSchema(n.body, ctx) : undefined,
        };
      });
      ch[opSuffix] = {
        operationId: `${operationId || id}-${opSuffix}`,
        summary: origin === 'server' ? 'Server messages' : 'Client messages',
        message: {oneOf: messages.map((n, i) => ({$ref: `#/components/messages/${id}-${origin}-${i}${n.type ? `-${n.type}` : ''}`}))},
      };
    };
    // Fern's quirk: server messages (AsyncAPI `subscribe`) go under
    // `publish`, client messages (`publish`) under `subscribe`.
    operation(messagesFor('subscribe'), 'server', 'publish', 'Server message');
    operation(messagesFor('publish'), 'client', 'subscribe', 'Client message');
    doc.channels[page.data.path] = ch;
    if (Object.keys(ctx.components).length > 0) {
      doc.components ??= {};
      doc.components.schemas = ctx.components;
    }
    return yaml.dump(doc);
  }

  /** A WebSocket channel page as Markdown, without the preamble. */
  function websocketMarkdown(page, {referenceUrl}) {
    const {channel} = channelOf(page);
    let specBlock;
    try {
      specBlock = `## AsyncAPI Specification\n\n${markdownCodeBlock(asyncApiYaml(page), 'yaml')}`;
    } catch (error) {
      console.warn(`[paradex] llms: ${page.url}: AsyncAPI block failed (${error.message})`);
    }
    return [
      `# ${page.data.title}`,
      `GET ${page.data.path}`,
      typeof channel.description === 'string' ? stripMdxFromMarkdown(channel.description) : undefined,
      `Reference: ${referenceUrl}`,
      specBlock,
    ]
      .filter((x) => x != null)
      .join('\n\n');
  }

  /** <EndpointRequestSnippet>/<EndpointResponseSnippet> replacements. */
  function snippetMarkdown(page) {
    const {data} = page;
    const head = `${data.method} ${data.server}${data.path}`;
    const all = exampleSnippets(page, operationOf(page));
    const request = all.length === 0 ? ['### Request', head].join('\n\n') : ['### Request', head, all.map(fence).join('\n\n')].join('\n\n');
    const response = data.responses?.[0];
    const status = Number(response?.status);
    const json = response?.example !== undefined ? JSON.stringify(response.example, null, 2) : undefined;
    return {
      request,
      response: json != null ? [`### Response${Number.isFinite(status) ? ` (${status})` : ''}`, markdownCodeBlock(json, 'json')].join('\n\n') : undefined,
    };
  }

  /**
   * Search-index sections of an API page, keyed to the anchors the HTML
   * page uses (request.auth, request.path, request.query, request.header,
   * request, response, response.error, send.publish, receive.subscribe).
   */
  function searchSections(page) {
    return searchSectionsMarkdown(page).map((section) => ({
      ...section,
      // Plain text: property lines without list markers or code ticks.
      text: section.text.replace(/^[ \t]*- /gm, '').replace(/`/g, ''),
    }));
  }

  function searchSectionsMarkdown(page) {
    const {data} = page;
    const sections = [];
    if (data.kind === 'websocket') {
      const {channel} = channelOf(page);
      sections.push({anchor: null, heading: null, text: [`WSS ${data.server}${data.path}`, channel.description].filter(Boolean).join('\n')});
      const {renderer, model} = modelFor(data.api);
      const params = Object.entries(channel.parameters ?? {}).map(([key, raw]) => {
        const p = model.deref(raw);
        return {key, valueShape: model.convert(p.schema ?? {type: 'string'}), description: p.description};
      });
      if (params.length) sections.push({anchor: 'request.path', heading: 'Path parameters', text: renderer.parameterLines(params).join('\n')});
      for (const [kind, anchor, heading] of [['publish', 'send.publish', 'Send'], ['subscribe', 'receive.subscribe', 'Receive']]) {
        const op = channel[kind];
        if (!op) continue;
        const message = model.deref(op.message ?? {});
        const payload = message.payload;
        const shape = payload ? model.convert(payload) : undefined;
        sections.push({anchor, heading, text: [op.summary, op.description, ...(shape ? renderer.bodyLines(shape) : [])].filter(Boolean).join('\n')});
      }
      return sections;
    }
    const m = endpointModel(page);
    const {renderer} = modelFor(data.api);
    sections.push({anchor: null, heading: null, text: [`${data.method} ${data.path}`, `${data.method} ${data.server}${data.path}`, m.op.description].filter(Boolean).join('\n')});
    const auth = authLines(m.auth);
    if (auth.length) sections.push({anchor: 'request.auth', heading: 'Authentication', text: auth[1]});
    const groups = [
      ['request.path', 'Path parameters', m.pathParameters],
      ['request.query', 'Query parameters', m.queryParameters],
      ['request.header', 'Headers', m.headers],
    ];
    for (const [anchor, heading, props] of groups) {
      if (props.length) sections.push({anchor, heading, text: renderer.parameterLines(props).join('\n')});
    }
    if (m.request?.body) sections.push({anchor: 'request', heading: 'Request', text: renderer.bodyLines(m.request.body).join('\n')});
    if (m.responses.length) {
      sections.push({
        anchor: 'response',
        heading: 'Response',
        text: m.responses.map((r) => [r.description, ...renderer.bodyLines(r.body)].filter(Boolean).join('\n')).join('\n'),
      });
    }
    if (m.errors.length) {
      sections.push({anchor: 'response.error', heading: 'Errors', text: m.errors.map((e) => `${e.statusCode} ${e.name ?? ''} ${e.description ?? ''}`.trim()).join('\n')});
    }
    return sections;
  }

  return {endpointMarkdown, websocketMarkdown, snippetMarkdown, searchSections};
}
