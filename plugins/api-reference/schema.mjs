// JSON Schema helpers shared by the REST (OpenAPI) and WebSocket (AsyncAPI)
// reference generators: $ref resolution, a render-friendly "shape" for the
// property tables, and example values built the way Fern built them.

import {micromark} from 'micromark';
import {gfm, gfmHtml} from 'micromark-extension-gfm';

export function markdownToHtml(markdown) {
  if (!markdown) return '';
  return micromark(String(markdown), {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  }).trim();
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
  const {minLength, maxLength, minimum, maximum, exclusiveMinimum, exclusiveMaximum, minItems, maxItems, pattern} = schema;
  if (minLength !== undefined && maxLength !== undefined) out.push(`${minLength}-${maxLength} characters`);
  else if (minLength !== undefined) out.push(`>=${minLength} character${minLength === 1 ? '' : 's'}`);
  else if (maxLength !== undefined) out.push(`<=${maxLength} characters`);
  if (minimum !== undefined && maximum !== undefined) out.push(`${minimum}-${maximum}`);
  else if (minimum !== undefined) out.push(`>=${minimum}`);
  else if (maximum !== undefined) out.push(`<=${maximum}`);
  if (typeof exclusiveMinimum === 'number') out.push(`>${exclusiveMinimum}`);
  if (typeof exclusiveMaximum === 'number') out.push(`<${exclusiveMaximum}`);
  if (minItems !== undefined) out.push(`>=${minItems} item${minItems === 1 ? '' : 's'}`);
  if (maxItems !== undefined) out.push(`<=${maxItems} items`);
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
  if (label.startsWith('list of') || label.startsWith('map from')) return label;
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

/** Example value for a schema, preferring authored examples. */
export function exampleFor(input, deref, {requiredOnly = false} = {}, stack = []) {
  if (input === undefined || input === null) return undefined;
  const ref = input.$ref;
  if (ref && stack.includes(ref)) return {};
  const nextStack = ref ? [...stack, ref] : stack;
  const schema = mergeAllOf(deref(input), deref);
  if (schema.example !== undefined) return schema.example;
  if (schema.examples !== undefined) {
    return Array.isArray(schema.examples) ? schema.examples[0] : Object.values(schema.examples)[0]?.value;
  }
  if (schema.default !== undefined && schema.enum === undefined) return schema.default;
  if (schema.enum) return schema.enum.find((v) => v !== null) ?? null;
  const variants = schema.oneOf ?? schema.anyOf;
  if (variants?.length) return exampleFor(variants[0], deref, {requiredOnly}, nextStack);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  if (type === 'array' || schema.items) {
    const item = exampleFor(schema.items ?? {}, deref, {requiredOnly}, nextStack);
    return item === undefined ? [] : [item];
  }
  if (type === 'object' || schema.properties || schema.additionalProperties) {
    const props = schema.properties ?? {};
    // Maps have no example keys; Fern rendered them as `{}`.
    if (!Object.keys(props).length && schema.additionalProperties) return {};
    const required = new Set(schema.required ?? []);
    const out = {};
    for (const [name, prop] of Object.entries(props)) {
      if (requiredOnly && !required.has(name)) continue;
      const value = exampleFor(prop, deref, {requiredOnly}, nextStack);
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
      return 'string';
    default:
      return undefined;
  }
}
