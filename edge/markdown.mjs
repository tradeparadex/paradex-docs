// Agent Markdown helpers: Fern's ?lang= / ?excludeSpec= filters, the agent
// "Page Not Found" body and Fern's not-found route suggestions.

import { trimSlashes } from './paths.mjs';

/** Fern's SDK language aliases (parseSdkLanguageFilter). */
export const SDK_LANGUAGE_MAPPINGS = {
  node: ['typescript', 'javascript', 'node', 'js', 'ts'],
  python: ['python', 'py'],
  java: ['java'],
  ruby: ['ruby'],
  go: ['go', 'golang'],
  csharp: ['csharp'],
  swift: ['swift'],
};

const LANGUAGE_ALIASES = new Map(
  Object.entries(SDK_LANGUAGE_MAPPINGS).flatMap(([sdk, names]) => names.map((n) => [n.toLowerCase(), sdk])),
);

/** Maps a ?lang= value to an SDK language; unknown values mean "no filter". */
export function parseSdkLanguageFilter(value) {
  if (value == null) return undefined;
  return LANGUAGE_ALIASES.get(String(value).toLowerCase());
}

/** Reads ?lang= and ?excludeSpec= the way Fern's .md and llms.txt routes do. */
export function agentFilterOptions(searchParams) {
  return {
    sdkLanguage: parseSdkLanguageFilter(searchParams.get('lang')),
    excludeSpec: searchParams.get('excludeSpec') === 'true',
  };
}

export function hasAgentFilter(options) {
  return options.sdkLanguage !== undefined || options.excludeSpec;
}

// Schema sections of an endpoint page, dropped by ?excludeSpec=true
// (renderEndpointSchemaMarkdown output, and the WebSocket AsyncAPI block).
const SPEC_SECTIONS = new Set(['Authentication', 'Servers', 'Request', 'Response', 'Errors', 'Types', 'Payload']);
const ASYNCAPI_SECTION = 'AsyncAPI Specification';
const REFERENCE_LINE = /^Reference: https?:\/\/\S+\s*$/;
const HTTP_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT) \S+\s*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** Splits Markdown into top-level lines and fenced code blocks. */
function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE_OPEN.exec(lines[i]);
    if (!open || (open[1][0] === '`' && open[2].includes('`'))) {
      blocks.push({ type: 'line', text: lines[i] });
      continue;
    }
    const marker = open[1];
    const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
    let end = i + 1;
    while (end < lines.length && !close.test(lines[end])) end++;
    const last = Math.min(end, lines.length - 1);
    blocks.push({
      type: 'fence',
      lang: open[2].trim().split(/\s+/)[0] ?? '',
      text: lines.slice(i, last + 1).join('\n'),
    });
    i = last;
  }
  return blocks;
}

const isBlank = (block) => block.type === 'line' && block.text.trim() === '';
const isLine = (block, re) => block.type === 'line' && re.test(block.text);

function keepsLanguage(lang, sdkLanguage) {
  return SDK_LANGUAGE_MAPPINGS[sdkLanguage].includes(String(lang).toLowerCase());
}

/**
 * Index after a run of fences (and the blank lines between them) starting at
 * `from`; collects the fences in `fences`.
 */
function fenceRun(blocks, from, fences) {
  let end = from;
  let i = from;
  while (i < blocks.length && (isBlank(blocks[i]) || blocks[i].type === 'fence')) {
    if (blocks[i].type === 'fence') {
      fences.push(blocks[i]);
      end = i + 1;
    }
    i++;
  }
  return end;
}

function joinFences(fences) {
  return fences.map((f) => f.text).join('\n\n');
}

/**
 * End (exclusive) of the schema part that starts at `from`: up to
 * "## Examples" (or the next page's "# " title), or for the AsyncAPI block
 * just past its YAML fence.
 */
function schemaEnd(blocks, from, asyncApi) {
  if (asyncApi) {
    for (let i = from + 1; i < blocks.length; i++) {
      if (blocks[i].type === 'fence') return i + 1;
      if (isLine(blocks[i], /^#{1,2} /)) return i;
    }
    return blocks.length;
  }
  for (let i = from + 1; i < blocks.length; i++) {
    if (isLine(blocks[i], /^## Examples\s*$/) || isLine(blocks[i], /^# /)) return i;
    // A page-level llms.txt ends with "> subtitle" after the page content.
    if (isLine(blocks[i], /^>/) && isBlank(blocks[i - 1])) {
      const rest = blocks.slice(i);
      if (rest.every((b) => isBlank(b) || isLine(b, /^>/))) return i;
    }
  }
  return blocks.length;
}

/**
 * Applies Fern's ?lang= and ?excludeSpec=true to agent Markdown (.md pages,
 * page-level and section llms.txt). The markers are the ones the build writes
 * (plugins/llms-api.mjs):
 *
 * - excludeSpec drops an endpoint page's schema: everything from its first
 *   schema heading ("## Authentication", "## Servers", "## Request",
 *   "## Response", "## Errors", "## Types") up to "## Examples" or the end of
 *   the page, and a WebSocket page's "## AsyncAPI Specification" YAML. Only
 *   headings after an endpoint page's "Reference: <url>" line count, so
 *   llms.txt link lists with the same headings are kept, and a page-level
 *   llms.txt keeps its closing "> subtitle".
 * - lang keeps only the matching fences under "**Code Samples**" and
 *   "**SDK Code**", and the matching non-curl fences of a "### Request" snippet
 *   (EndpointRequestSnippet output, where curl is always kept).
 */
export function filterAgentMarkdown(text, { sdkLanguage, excludeSpec }) {
  if (sdkLanguage === undefined && !excludeSpec) return text;
  const trailing = /\n*$/.exec(text)[0];
  const blocks = parseBlocks(text);
  const out = [];
  let inEndpoint = false;
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === 'line') {
      if (/^# /.test(block.text)) inEndpoint = false;
      else if (REFERENCE_LINE.test(block.text)) inEndpoint = true;

      const h2 = /^## (.+?)\s*$/.exec(block.text);
      if (excludeSpec && inEndpoint && h2 && (SPEC_SECTIONS.has(h2[1]) || h2[1] === ASYNCAPI_SECTION)) {
        const asyncApi = h2[1] === ASYNCAPI_SECTION;
        if (!asyncApi || blocks.slice(i + 1).find((b) => !isBlank(b))?.type === 'fence') {
          let end = schemaEnd(blocks, i, asyncApi);
          if (asyncApi) while (end < blocks.length && isBlank(blocks[end])) end++;
          i = end;
          continue;
        }
      }

      if (sdkLanguage !== undefined && /^\*\*(Code Samples|SDK Code)\*\*\s*$/.test(block.text)) {
        const fences = [];
        const end = fenceRun(blocks, i + 1, fences);
        const kept = fences.filter((f) => keepsLanguage(f.lang, sdkLanguage));
        if (kept.length > 0) {
          out.push(block, { type: 'line', text: '' }, { type: 'line', text: joinFences(kept) });
          i = end;
        } else {
          // Drop the label too, plus one blank line so spacing stays single.
          i = end < blocks.length && isBlank(blocks[end]) ? end + 1 : end;
        }
        continue;
      }

      if (
        sdkLanguage !== undefined &&
        /^### Request\s*$/.test(block.text) &&
        i + 2 < blocks.length &&
        isBlank(blocks[i + 1]) &&
        isLine(blocks[i + 2], HTTP_LINE)
      ) {
        const fences = [];
        const end = fenceRun(blocks, i + 3, fences);
        const kept = fences.filter((f) => f.lang.toLowerCase() === 'curl' || keepsLanguage(f.lang, sdkLanguage));
        out.push(block, blocks[i + 1], blocks[i + 2]);
        if (kept.length > 0) out.push({ type: 'line', text: '' }, { type: 'line', text: joinFences(kept) });
        i = end;
        continue;
      }
    }
    out.push(block);
    i++;
  }
  return `${out
    .map((b) => b.text)
    .join('\n')
    .replace(/\n+$/, '')}${trailing}`;
}

/**
 * Fern's agentNotFoundResponse body (LLM chat disabled). Suggestions are
 * [{title, href}] with href a site path ("/docs/x"); they are listed as .md links.
 */
export function notFoundBody(siteUrl, suggestions = []) {
  const lines = ['# Page Not Found', '', 'This page does not exist.', ''];
  if (suggestions.length > 0) {
    lines.push('## Similar pages', '');
    for (const s of suggestions) lines.push(`- [${s.title}](${siteUrl}${s.href}.md)`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Lowercased, without leading and trailing slashes (linear time). */
function normalizeSlug(s) {
  return trimSlashes(String(s).toLowerCase());
}

/** No suggestions for longer slugs: no page URL is near this long. */
export const MAX_SUGGESTION_SLUG_LENGTH = 256;

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = ca === b.charCodeAt(j - 1) ? prev[j - 1] : Math.min(prev[j - 1] + 1, cur[j - 1] + 1, prev[j] + 1);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Fern's getRouteSuggestions score for a requested slug and a candidate slug. */
export function routeScore(requested, candidate) {
  return scoreNormalized(normalizeSlug(requested), normalizeSlug(candidate));
}

function scoreNormalized(r, n) {
  if (r === n) return 1;
  const rs = r.split('/').filter((s) => s.length > 0);
  const ns = n.split('/').filter((s) => s.length > 0);
  const shared = rs.length > 0 && ns.length > 0 ? rs.filter((s) => ns.includes(s)).length / Math.max(rs.length, ns.length) : 0;
  const contains = n.includes(r) || r.includes(n) ? 0.3 : 0;
  const maxLength = Math.max(r.length, n.length);
  const similarity = maxLength === 0 ? 1 : 1 - levenshtein(r, n) / maxLength;
  return 0.5 * similarity + 0.3 * shared + 0.2 * contains;
}

/**
 * Up to `limit` pages most similar to the requested slug, as [{title, href}].
 * `pages` are search-index pages ({url, title}). Mirrors Fern: no suggestions
 * for the root, unique hrefs, stable order for equal scores.
 */
export function suggestRoutes(requested, pages, limit = 3) {
  if (!requested || requested === '/' || !Array.isArray(pages) || pages.length === 0) return [];
  // The requested slug is normalized once; an overlong one (a client sending
  // thousands of characters) gets no suggestions instead of a Levenshtein
  // against every page.
  const r = normalizeSlug(requested);
  if (r.length > MAX_SUGGESTION_SLUG_LENGTH) return [];
  const scored = pages
    .filter((p) => p && typeof p.url === 'string' && typeof p.title === 'string')
    .map((p) => ({ title: p.title, href: p.url, score: scoreNormalized(r, normalizeSlug(p.url)) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    if (seen.has(s.href)) continue;
    seen.add(s.href);
    out.push({ title: s.title, href: s.href });
    if (out.length >= limit) break;
  }
  return out;
}
