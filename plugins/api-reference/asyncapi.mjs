// AsyncAPI 2.x -> WebSocket channel pages, reproducing Fern's URLs/labels.
//
// Each channel is a sidebar group holding one page; both URL segments are
// the channel address in kebab case (`/bbo.{market_symbol}` ->
// `bbo-market-symbol/bbo-market-symbol`). The page title is the channel's
// x-fern-display-name.

import fs from 'node:fs';
import yaml from 'js-yaml';

import {slugify} from '../navigation.mjs';
import {createResolver, exampleFor, markdownToHtml, plainSummary, toShape} from './schema.mjs';

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via']);
const SPECIAL_WORDS = {id: 'ID', url: 'URL', api: 'API', rpi: 'RPI', jwt: 'JWT'};

/** "/order.cancel_on_disconnect" -> "Order Cancel on Disconnect" */
export function channelTitle(address) {
  const words = address
    .replace(/^\//, '')
    .replace(/[{}@]/g, '')
    .split(/[._\s[\]-]+/)
    .filter(Boolean);
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (SPECIAL_WORDS[lower]) return SPECIAL_WORDS[lower];
      if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function loadAsyncApi(specPath) {
  return yaml.load(fs.readFileSync(specPath, 'utf8'));
}

export function buildChannels(spec, {apiName}) {
  const {deref} = createResolver(spec);
  const server = Object.values(spec.servers ?? {})[0];
  const serverUrl = server?.url ?? '';
  const serverBase = serverUrl.split('?')[0];
  const channels = [];

  for (const [address, channelRaw] of Object.entries(spec.channels ?? {})) {
    const channel = deref(channelRaw);
    const slug = slugify(address);
    const displayName = channel['x-fern-display-name'] ?? address.replace(/^\//, '');
    const path = address.startsWith('/') ? address : `/${address}`;

    const pathParams = Object.entries(channel.parameters ?? {}).map(([name, raw]) => {
      const param = deref(raw);
      return {
        name,
        required: true,
        shape: {
          ...toShape(param.schema ?? {type: 'string'}, deref),
          ...(param.description ? {description: markdownToHtml(param.description)} : {}),
        },
      };
    });

    const operation = (kind) => {
      const op = channel[kind];
      if (!op) return undefined;
      const message = deref(op.message ?? {});
      const variants = message.oneOf ? message.oneOf.map(deref) : [message];
      const payloads = variants.map((m) => m.payload).filter(Boolean);
      const payload = payloads.length > 1 ? {oneOf: payloads} : payloads[0];
      return {
        direction: kind,
        summary: op.summary,
        descriptionHtml: markdownToHtml(op.description),
        shape: payload ? toShape(payload, deref) : {kind: 'object', label: 'object', properties: []},
        // Fern built message examples from the schema alone (property-name
        // placeholders), not from the spec's `example` values.
        example: payload ? (exampleFor(payload, deref, {requiredOnly: true, placeholders: true}) ?? {}) : {},
      };
    };
    const send = operation('publish');
    const receive = operation('subscribe');

    channels.push({
      groupSlug: slug,
      groupTitle: channelTitle(address),
      methodSlug: slug,
      data: {
        api: apiName,
        kind: 'websocket',
        method: 'WSS',
        title: displayName,
        path,
        displayPath: path.replace(/\{([^}]+)\}/g, ':$1').replace(/[[\]]/g, ''),
        server: serverBase,
        // Fern showed the server URL (with its query string) + the address.
        handshakeUrl: serverUrl + path.replace(/[{}[\]]/g, ''),
        summary:
          plainSummary(send?.summary ?? receive?.summary ?? channel.description) ?? displayName,
        descriptionHtml: markdownToHtml(channel.description),
        descriptionMarkdown: channel.description ?? '',
        pathParams,
        messages: [send, receive].filter(Boolean).map(({direction, example}) => ({direction, example})),
        send,
        receive,
      },
    });
  }
  return channels;
}
