// MDX -> the Markdown Fern served to AI agents ("llm" content mode).
//
// A port of Fern's filterMarkdownForLlm (fern-docs bundle, _0sg90kl._.js
// functions pg/pm and helpers h0-h9, pa/po/pl), run on a real MDX syntax
// tree (unified + remark-parse + remark-mdx + remark-gfm + remark-math) and
// written back with remark-stringify using Fern's options ({rule: '-'}, so
// thematic breaks are `---` and list bullets keep the mdast default `*`).
//
// Rules, in Fern's order:
//   - `{...}` expressions and import/export are removed. One deliberate
//     difference: `export const x = "..."` values are substituted into
//     `{x}` (instrument pages rely on it), and a bare `{Name}` the page does
//     not define stays literal text, as on the HTML page.
//   - <llms-ignore> is removed; <llms-only> is unwrapped.
//   - <style>, <script>, iframe/video/audio/embed/object/source/track and
//     anything whose `src` is a data: URI are removed; className and style
//     attributes are dropped.
//   - div/span/section are unwrapped (removed when empty); lowercase HTML
//     becomes Markdown (h1-h6, b/strong, i/em, s/del, blockquote, br, hr,
//     a[href], img, ul/ol/li, code, p); header/footer/main/article/aside/
//     nav/figure/figcaption are unwrapped.
//   - Callouts (Note, Tip, Warning, Info, Error, Success, Check, Callout,
//     Launch, LaunchNote) become a blockquote opening with **Title**.
//   - Any other capitalised component with a `title` becomes `#### title`
//     (a link when it has `href`) followed by its children; one without a
//     title is unwrapped, and removed when it has no children
//     (<ChangelogTags/>, <Icon/>, <Frame/>, ...). Unlike Fern, an untitled
//     inline component (<Badge>Beta</Badge> in a sentence) is unwrapped in
//     place instead of being split into its own paragraph.
//   - <ParamField> becomes "**`name`** `type` — required, ...", its
//     children and a `---` rule.
//   - Paragraphs made only of links are split one link per paragraph.
// Before that, <EndpointRequestSnippet>/<EndpointResponseSnippet> are
// rendered to Markdown (Fern's resolveApiMarkdownComponents), and after it
// surfaceCodeBlockTitles() adds **`title`** above fences with title=/filename=.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkStringify from 'remark-stringify';
import {visit} from 'unist-util-visit';

import {inlineSnippets} from './fern-mdx.mjs';

/** Front matter, including an empty block (`---\n---`). */
export const FRONT_MATTER = /^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;

const processor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkStringify, {rule: '-'});

/** Fern's plain mdastToMarkdown (default options), used by stripMdxFromMarkdown. */
const plainProcessor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkMath).use(remarkStringify);

// ---------------------------------------------------------------------------
// Agent preamble and small Markdown helpers (Fern: getAgentPreamble,
// formatPageDirectiveAsBlockquote, markdownCodeBlock, markdownInlineCode).

/** True unless the build sets DOCS_MCP_SERVER=off (hosts without the edge layer). */
export function mcpEnabled() {
  return String(process.env.DOCS_MCP_SERVER ?? '').trim().toLowerCase() !== 'off';
}

/** Every line prefixed "> " (empty lines become ">"). */
export function blockquote(text) {
  return String(text)
    .split('\n')
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n');
}

/** The blockquote Fern put at the top of every .md and section llms.txt. */
export function agentPreamble(siteUrl, {mcp = mcpEnabled()} = {}) {
  const lines = [
    'For clean Markdown of any page, append .md to the page URL.',
    `For a complete documentation index, see ${siteUrl}/llms.txt.`,
  ];
  if (mcp) lines.push(`For AI client integration (Claude Code, Cursor, etc.), connect to the MCP server at ${siteUrl}/_mcp/server.`);
  return blockquote(lines.join('\n'));
}

const longestBacktickRun = (text) => {
  let max = 0;
  for (const [run] of String(text).matchAll(/`+/g)) max = Math.max(max, run.length);
  return max;
};

export function markdownCodeBlock(code, info = '') {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1));
  return `${fence}${info}\n${code}\n${fence}`;
}

export function markdownInlineCode(text) {
  const value = String(text);
  const ticks = '`'.repeat(longestBacktickRun(value) + 1);
  const pad = /^[` ]|[` ]$/.test(value) && !/^ *$/.test(value) ? ' ' : '';
  return `${ticks}${pad}${value}${pad}${ticks}`;
}

/**
 * Fern's surfaceCodeBlockTitles: a "**`title`**" line before every fence
 * whose meta has title="..." or filename="...".
 */
export function surfaceCodeBlockTitles(markdown) {
  const FENCE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/;
  const TITLE = /(?:^|\s)(?:title|filename)="((?:[^"\\]|\\.)*)"/;
  const out = [];
  let open;
  for (const line of markdown.split('\n')) {
    const match = FENCE.exec(line);
    if (!open) {
      if (match) {
        const [, indent = '', marker = ''] = match;
        open = {char: marker[0] ?? '`', length: marker.length};
        const info = (match[3] ?? '').trim();
        const space = info.search(/\s/);
        const meta = space === -1 ? '' : info.slice(space + 1).trim();
        const title = meta ? TITLE.exec(meta)?.[1]?.replaceAll('\\"', '"') : undefined;
        if (title) {
          const label = `${indent}**\`${title}\`**`;
          let i = out.length - 1;
          while (i >= 0 && (out[i] ?? '').trim() === '') i--;
          if (i < 0 || out[i] !== label) {
            if (out.length > 0 && (out[out.length - 1] ?? '').trim() !== '') out.push('');
            out.push(label, '');
          }
        }
      }
      out.push(line);
      continue;
    }
    if (match && (match[2] ?? '')[0] === open.char && (match[2] ?? '').length >= open.length && (match[3] ?? '').trim() === '') {
      open = undefined;
    }
    out.push(line);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// MDX attribute values.

/** Fern's extractAttributeValueLiteral, plus `{name}` for page constants. */
function attributeLiteral(value, constants) {
  if (typeof value === 'string') return value;
  if (value?.type !== 'mdxJsxAttributeValueExpression') return undefined;
  const program = value.data?.estree;
  if (!program) return undefined;
  const statement = program.body?.[0];
  if (statement?.type === 'ExpressionStatement' && statement.expression.type === 'Identifier' && constants?.has(statement.expression.name)) {
    return constants.get(statement.expression.name);
  }
  const literals = [];
  const texts = [];
  let jsx = false;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') return;
    if (['JSXElement', 'JSXFragment', 'JSXOpeningElement', 'JSXOpeningFragment'].includes(node.type)) jsx = true;
    if (node.type === 'JSXText') texts.push(node.value);
    if (node.type === 'JSXExpressionContainer' && node.expression?.type === 'Literal' && typeof node.expression.value === 'string') {
      texts.push(node.expression.value);
    }
    if (node.type === 'Literal') literals.push(node.value);
    for (const [key, child] of Object.entries(node)) {
      if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
      if (child && typeof child === 'object') walk(child);
    }
  };
  walk(program);
  if (jsx && texts.length > 0) return texts.join('').trim();
  return literals.length === 1 ? literals[0] : undefined;
}

const isJsx = (node) => node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement';

function attr(node, name, constants) {
  const found = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
  if (!found) return undefined;
  const value = attributeLiteral(found.value, constants);
  return typeof value === 'string' ? value : undefined;
}

function boolAttr(node, name, constants) {
  const found = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
  if (!found) return false;
  if (found.value == null) return true;
  const value = attributeLiteral(found.value, constants);
  if (typeof value === 'boolean') return value;
  return typeof value !== 'string' || (value !== 'false' && value !== '');
}

// ---------------------------------------------------------------------------
// Fern's tree helpers.

const MEDIA = new Set(['iframe', 'video', 'audio', 'embed', 'object', 'source', 'track']);
const HTML_HEADINGS = {h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6};
const UNWRAP_SECTIONING = new Set(['header', 'footer', 'main', 'article', 'aside', 'nav', 'figure', 'figcaption']);
const UNWRAP_INLINE = new Set(['span', 'button', 'label', 'small', 'sup', 'sub', 'u']);
const FLOW = new Set(['paragraph', 'heading', 'thematicBreak', 'blockquote', 'list', 'table', 'code', 'html', 'mdxJsxFlowElement', 'mdxFlowExpression', 'mdxjsEsm']);
const BLOCK = new Set(['heading', 'paragraph', 'list', 'blockquote', 'code', 'table', 'thematicBreak']);
const PHRASING = new Set(['text', 'link', 'emphasis', 'strong', 'delete', 'inlineCode', 'image', 'break', 'footnoteReference', 'imageReference', 'linkReference']);
const CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem', 'mdxJsxFlowElement', 'mdxJsxTextElement']);
const CALLOUTS = {
  Callout: 'Note', Info: 'Info', Warning: 'Warning', Success: 'Success', Error: 'Error',
  Note: 'Note', Tip: 'Tip', Check: 'Check', Launch: 'Launch', LaunchNote: 'Launch',
};

/** Fern's wrapPhrasingInParagraphs. */
function wrapPhrasing(children) {
  const out = [];
  let pending = [];
  const flush = () => {
    if (pending.length > 0) {
      if (pending.some((n) => n.type !== 'text' || n.value.trim() !== '')) out.push({type: 'paragraph', children: pending});
      pending = [];
    }
  };
  for (const child of children) {
    if (FLOW.has(child.type)) {
      flush();
      out.push(child);
    } else pending.push(child);
  }
  flush();
  return out;
}

const isBlankText = (node) => node.type === 'text' && node.value.trim() === '';

/** Trim blank text at both ends of a phrasing run (h6). */
function trimPhrasing(children) {
  const out = [...children];
  while (out.length > 0 && isBlankText(out[0])) out.shift();
  while (out.length > 0 && isBlankText(out[out.length - 1])) out.pop();
  const first = out[0];
  if (first?.type === 'text') out[0] = {...first, value: first.value.trimStart()};
  const last = out[out.length - 1];
  if (last?.type === 'text') out[out.length - 1] = {...last, value: last.value.trimEnd()};
  return out;
}

/** hK: children of an inline wrapper, plus a space after a flow element. */
function unwrapInline(node) {
  return node.type !== 'mdxJsxFlowElement' || node.children.length === 0 ? node.children : [...node.children, {type: 'text', value: ' '}];
}

/** Lowercase HTML element -> Markdown nodes (undefined: leave it). */
function htmlToMarkdown(node, constants) {
  const name = node.name;
  if (name == null || !/^[a-z]/.test(name)) return undefined;
  if (node.attributes.some((a) => a.type === 'mdxJsxAttribute' && /^[a-z]+[A-Z]/.test(a.name))) return undefined;
  const children = node.children;
  const phrasing = trimPhrasing(children);
  const depth = HTML_HEADINGS[name];
  if (depth != null) return [{type: 'heading', depth, children: phrasing}];
  if (UNWRAP_INLINE.has(name)) return unwrapInline(node);
  if (UNWRAP_SECTIONING.has(name)) return wrapPhrasing(children);
  switch (name) {
    case 'p':
      return [{type: 'paragraph', children: phrasing}];
    case 'b':
    case 'strong':
      return [{type: 'strong', children: phrasing}];
    case 'i':
    case 'em':
      return [{type: 'emphasis', children: phrasing}];
    case 's':
    case 'del':
      return [{type: 'delete', children: phrasing}];
    case 'blockquote':
      return [{type: 'blockquote', children: wrapPhrasing(children)}];
    case 'br':
      return [{type: 'break'}];
    case 'hr':
      return [{type: 'thematicBreak'}];
    case 'a': {
      const href = attr(node, 'href', constants);
      if (href == null) return wrapPhrasing(children);
      return [{type: 'link', url: href, title: attr(node, 'title', constants) ?? null, children: phrasing}];
    }
    case 'img': {
      const src = attr(node, 'src', constants);
      if (src == null) return [];
      return [{type: 'image', url: src, alt: attr(node, 'alt', constants) ?? null, title: attr(node, 'title', constants) ?? null}];
    }
    case 'ul':
    case 'ol': {
      const start = Number(attr(node, 'start', constants));
      return [
        {
          type: 'list',
          ordered: name === 'ol',
          start: name === 'ol' && Number.isFinite(start) ? start : null,
          spread: false,
          children: children.filter((c) => c.type !== 'text' || c.value.trim() !== ''),
        },
      ];
    }
    case 'li':
      return [{type: 'listItem', spread: false, checked: null, children: wrapPhrasing(children)}];
    case 'code':
      if (children.length > 0 && children.every((c) => c.type === 'text')) {
        return [{type: 'inlineCode', value: children.map((c) => c.value).join('')}];
      }
      return undefined;
    default:
      return undefined;
  }
}

/** `#### Title` (or `#### [Title](href)`) for a component with a title. */
function titleHeading(node, constants) {
  const title = attr(node, 'title', constants)?.trim();
  if (title == null || title === '') return undefined;
  const text = {type: 'text', value: title};
  const href = attr(node, 'href', constants)?.trim();
  return {type: 'heading', depth: 4, children: [href != null && href !== '' ? {type: 'link', url: href, children: [text]} : text]};
}

const capitalise = (value, fallback) => {
  const v = value?.trim().toLowerCase();
  return v == null || v === '' ? fallback : v.charAt(0).toUpperCase() + v.slice(1);
};

function paramField(node, constants) {
  const name =
    attr(node, 'title', constants) ?? attr(node, 'name', constants) ?? attr(node, 'path', constants) ??
    attr(node, 'query', constants) ?? attr(node, 'body', constants) ?? attr(node, 'header', constants);
  const type = attr(node, 'type', constants);
  const def = attr(node, 'default', constants);
  const children = wrapPhrasing(node.children);
  const head = [];
  if (name != null && name !== '') head.push({type: 'strong', children: [{type: 'inlineCode', value: name}]});
  if (type != null && type !== '') {
    if (head.length > 0) head.push({type: 'text', value: ' '});
    head.push({type: 'inlineCode', value: type});
  }
  const flags = [];
  if (boolAttr(node, 'required', constants)) flags.push('required');
  if (boolAttr(node, 'deprecated', constants)) flags.push('deprecated');
  if (def != null && def !== '') flags.push(`default: ${def}`);
  if (flags.length > 0) head.push({type: 'text', value: `${head.length > 0 ? ' — ' : ''}${flags.join(', ')}`});
  return head.length === 0 ? children : [{type: 'paragraph', children: head}, ...children, {type: 'thematicBreak'}];
}

/** <If>: no viewer is logged in when an agent reads the page. */
function ifIsVisible(node) {
  const names = new Set(node.attributes.filter((a) => a.type === 'mdxJsxAttribute').map((a) => a.name));
  if (names.has('loggedIn')) {
    const value = node.attributes.find((a) => a.name === 'loggedIn').value;
    const literal = value == null ? true : attributeLiteral(value);
    return literal === false || literal === 'false';
  }
  if (names.has('roles') || names.has('viewer')) {
    const raw = node.attributes.find((a) => a.name === 'roles' || a.name === 'viewer').value;
    return typeof raw?.value === 'string' && raw.value.includes('everyone');
  }
  return true;
}

// Link normalisation (Fern h0-h9).
const linkHasBlocks = (link) => link.children.some((c) => BLOCK.has(c.type));
const isBlockish = (node) => BLOCK.has(node.type) || (node.type === 'link' && linkHasBlocks(node));
const asParagraph = (node) => ({type: 'paragraph', children: [node]});

function splitLinks(children) {
  const links = children.filter((c) => c.type === 'link');
  const onlyLinks = children.every((c) => c.type === 'link' || isBlankText(c));
  if (links.length >= 2 && onlyLinks) return links.map(asParagraph);
  return undefined;
}

function flattenParagraph(children) {
  const out = [];
  let pending = [];
  const flush = () => {
    if (pending.some((c) => !isBlankText(c))) {
      const trimmed = trimPhrasing(pending);
      out.push(...(splitLinks(trimmed) ?? [{type: 'paragraph', children: trimmed}]));
    }
    pending = [];
  };
  for (const child of children) {
    if (child.type === 'paragraph') {
      flush();
      out.push(...flattenParagraph(child.children));
    } else if (child.type === 'link' && linkHasBlocks(child)) {
      flush();
      out.push(...blockLink(child));
    } else if (BLOCK.has(child.type)) {
      flush();
      out.push(child);
    } else pending.push(child);
  }
  flush();
  return out;
}

function blockLink(link) {
  const blocks = flattenParagraph(link.children);
  const first = blocks.find((b) => b.type === 'heading' || b.type === 'paragraph');
  if (first != null) first.children = [{type: 'link', url: link.url, title: link.title, children: trimPhrasing(first.children)}];
  return blocks;
}

function collapseLinkWhitespace(node, inLink = false) {
  if (node.type === 'text') {
    if (inLink) node.value = node.value.replace(/\s+/g, ' ');
    return;
  }
  if (Array.isArray(node.children)) for (const child of node.children) collapseLinkWhitespace(child, inLink || node.type === 'link');
}

function normaliseLinks(parent, parentType = 'root') {
  for (let i = 0; i < parent.children.length; i++) {
    const node = parent.children[i];
    if (node == null) continue;
    if (node.type === 'link') {
      collapseLinkWhitespace(node);
      parent.children.splice(i, 1, ...(linkHasBlocks(node) ? blockLink(node) : [asParagraph(node)]));
      i--;
      continue;
    }
    if (node.type === 'paragraph' || node.type === 'heading') {
      node.children = trimPhrasing(node.children);
      for (const child of node.children) collapseLinkWhitespace(child);
    }
    if (node.type === 'paragraph') {
      const replacement = node.children.some(isBlockish) ? flattenParagraph(node.children) : splitLinks(node.children);
      if (replacement != null) {
        parent.children.splice(i, 1, ...replacement);
        i--;
      }
      continue;
    }
    if (CONTAINERS.has(node.type) && Array.isArray(node.children)) normaliseLinks(node, node.type);
  }
  if (parentType === 'root' || parentType === 'blockquote' || parentType === 'listItem') {
    const out = [];
    let pending = [];
    const flush = () => {
      if (pending.some((c) => !isBlankText(c))) out.push({type: 'paragraph', children: trimPhrasing(pending)});
      pending = [];
    };
    for (const child of parent.children) {
      if (PHRASING.has(child.type)) {
        pending.push(child);
        continue;
      }
      flush();
      out.push(child);
    }
    flush();
    parent.children = out;
  }
}

// ---------------------------------------------------------------------------
// Page constants (`export const x = "..."`) and the filter itself.

const IDENTIFIER = /^\s*([A-Za-z_$][\w$]*)\s*$/;
const GLOBALS = new Set(['props', 'frontMatter', 'toc', 'contentTitle', 'metadata', 'assets', 'undefined', 'null', 'true', 'false']);

function collectDeclarations(tree) {
  const constants = new Map();
  const declared = new Set(GLOBALS);
  visit(tree, 'mdxjsEsm', (node) => {
    for (const statement of node.data?.estree?.body ?? []) {
      const declaration = statement.declaration ?? statement;
      for (const d of declaration.declarations ?? []) {
        if (d.id?.type !== 'Identifier') continue;
        declared.add(d.id.name);
        const init = d.init;
        if (init?.type === 'Literal' && typeof init.value === 'string') constants.set(d.id.name, init.value);
        else if (init?.type === 'TemplateLiteral' && init.expressions.length === 0) {
          constants.set(d.id.name, init.quasis.map((q) => q.value.cooked).join(''));
        }
      }
      if (declaration.id?.name) declared.add(declaration.id.name);
      for (const spec of statement.specifiers ?? []) if (spec.local?.name) declared.add(spec.local.name);
    }
  });
  return {constants, declared};
}

/** HTML whitespace (Fern's collapseWhiteSpace with style "html"). */
const HTML_WHITESPACE = /^[\t\n\v\f\r ]*$/;

/**
 * Fern's toTree step `gm()` (MDX's mark-and-unravel): a paragraph made only of
 * inline JSX elements / expressions and whitespace text is replaced by those
 * nodes as flow elements, whitespace dropped. So `<li>a</li>` rows written
 * one per line inside `<ul>` become list items, and spans on separate lines
 * become separate flow elements.
 */
function unravelJsxParagraphs(tree) {
  visit(tree, 'paragraph', (node, index, parent) => {
    if (parent == null || typeof index !== 'number') return undefined;
    let sawJsx = false;
    for (const child of node.children) {
      if (child.type === 'mdxJsxTextElement' || child.type === 'mdxTextExpression') sawJsx = true;
      else if (!(child.type === 'text' && HTML_WHITESPACE.test(child.value))) return undefined;
    }
    if (!sawJsx) return undefined;
    const out = [];
    for (const child of node.children) {
      if (child.type === 'mdxJsxTextElement') child.type = 'mdxJsxFlowElement';
      if (child.type === 'mdxTextExpression') child.type = 'mdxFlowExpression';
      if (child.type === 'text' && /^[\t\r\n ]+$/.test(child.value)) continue;
      out.push(child);
    }
    parent.children.splice(index, 1, ...out);
    return index;
  });
}

/**
 * Fern's filterMarkdownForLlm on an MDX body (no front matter). Throws when
 * the body does not parse; callers fall back to a simpler conversion.
 */
export function filterMarkdownForLlm(body, {resolveUrl} = {}) {
  const tree = processor.parse(body);
  unravelJsxParagraphs(tree);
  const {constants, declared} = collectDeclarations(tree);

  visit(tree, (node, index, parent) => {
    if (parent == null || index == null) return undefined;
    const replace = (...nodes) => {
      parent.children.splice(index, 1, ...nodes);
      return index;
    };

    if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') {
      const match = IDENTIFIER.exec(node.value ?? '');
      if (match && (constants.has(match[1]) || !declared.has(match[1]))) {
        const value = constants.has(match[1]) ? constants.get(match[1]) : `{${match[1]}}`;
        const text = {type: 'text', value};
        replace(node.type === 'mdxFlowExpression' ? {type: 'paragraph', children: [text]} : text);
        return index + 1;
      }
      return replace();
    }
    if (node.type === 'mdxjsEsm') return replace();
    if (!isJsx(node)) return undefined;

    const name = node.name;
    if (name === 'llms-ignore') return replace();
    if (name === 'llms-only') return replace(...wrapPhrasing(node.children));
    if (name === 'If') return ifIsVisible(node) ? replace(...wrapPhrasing(node.children)) : replace();
    if (name === 'style' || name === 'script') return replace();
    if (name === 'ParamField') return replace(...paramField(node, constants));
    if (name != null && MEDIA.has(name)) return replace();
    const src = node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'src')?.value;
    if (typeof src === 'string' && src.startsWith('data:')) return replace();

    node.attributes = node.attributes.filter((a) => a.type !== 'mdxJsxAttribute' || (a.name !== 'className' && a.name !== 'class' && a.name !== 'style'));

    if (name === 'div' || name === 'span' || name === 'p' || name === 'section') {
      if (node.children.length === 0) return replace();
      if (name !== 'p') return replace(...(UNWRAP_INLINE.has(name) ? unwrapInline(node) : wrapPhrasing(node.children)));
    }
    const html = htmlToMarkdown(node, constants);
    if (html != null) return replace(...html);

    if (name != null && /^[A-Z]/.test(name)) {
      const label = CALLOUTS[name];
      if (label != null) {
        const title = attr(node, 'title', constants)?.trim();
        const heading = title != null && title !== '' ? title : capitalise(attr(node, 'intent', constants), label);
        return replace({
          type: 'blockquote',
          children: [{type: 'paragraph', children: [{type: 'strong', children: [{type: 'text', value: heading}]}]}, ...wrapPhrasing(node.children)],
        });
      }
      const heading = titleHeading(node, constants);
      if (node.children.length === 0) return heading != null ? replace(heading) : replace();
      // An untitled inline component (<Badge>, <Button>) keeps its text in
      // the sentence; Fern wrapped it in a paragraph, which split the line.
      if (heading == null && node.type === 'mdxJsxTextElement') return replace(...node.children);
      const children = wrapPhrasing(node.children);
      return replace(...(heading != null ? [heading, ...children] : children));
    }
    if (name != null && /^[a-z]/.test(name) && node.attributes.some((a) => a.type === 'mdxJsxAttribute' && /^[a-z]+[A-Z]/.test(a.name))) {
      if (node.children.length === 0) return replace();
      return replace(...wrapPhrasing(node.children));
    }
    return undefined;
  });

  normaliseLinks(tree);

  if (resolveUrl) {
    visit(tree, (node) => {
      if ((node.type === 'image' || node.type === 'link') && typeof node.url === 'string') node.url = resolveUrl(node.url);
      if (isJsx(node)) {
        for (const a of node.attributes ?? []) {
          if (a.type === 'mdxJsxAttribute' && (a.name === 'src' || a.name === 'href') && typeof a.value === 'string') a.value = resolveUrl(a.value);
        }
      }
    });
  }

  return processor.stringify(tree).trim();
}

/** Offset in `text` of an MDX parse error (its point, or the end of its range). */
function errorOffset(error, text) {
  const point = error?.place?.start ?? error?.place ?? (error?.line != null ? {line: error.line, column: error.column} : undefined);
  if (typeof point?.offset === 'number') return point.offset;
  if (typeof point?.line !== 'number') return text.length;
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < point.line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + Math.max(0, (point.column ?? 1) - 1);
}

/**
 * Parses MDX the way Fern's toTree sanitizes it: on a parse error, the last
 * unescaped `<` or `{` at or before the error is escaped and the parse is
 * retried (`a <= b`, `0x<new_key>` and `<maker>` become text); after 100
 * tries every `<` and `{` is escaped.
 */
function parseLenient(parser, text) {
  let current = text;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      return parser.parse(current);
    } catch (error) {
      let at = Math.min(errorOffset(error, current), current.length - 1);
      while (at >= 0 && !((current[at] === '<' || current[at] === '{') && current[at - 1] !== '\\')) at--;
      if (at < 0) break;
      current = `${current.slice(0, at)}\\${current.slice(at)}`;
    }
  }
  return parser.parse(current.replace(/(?<!\\)([{<])/g, '\\$1'));
}

/** Fern's stripMdxFromMarkdown (API descriptions): JSX unwrapped, {...} and ESM dropped. */
export function stripMdxFromMarkdown(text) {
  if (!/[<{]/.test(text)) return text;
  try {
    const tree = parseLenient(plainProcessor, text);
    const strip = (children) => {
      const out = [];
      for (const node of children) {
        if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression' || node.type === 'mdxjsEsm') continue;
        if (isJsx(node)) {
          out.push(...strip(node.children ?? []));
          continue;
        }
        if (Array.isArray(node.children)) node.children = strip(node.children);
        out.push(node);
      }
      return out;
    };
    tree.children = strip(tree.children);
    return plainProcessor.stringify(tree).trim();
  } catch {
    return text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
  }
}

// ---------------------------------------------------------------------------
// <EndpointRequestSnippet> / <EndpointResponseSnippet> (Fern's
// resolveApiMarkdownComponents), replaced in the source before filtering.

const SNIPPET_COMPONENTS = new Set(['EndpointRequestSnippet', 'EndpointResponseSnippet']);

/**
 * @param {string} body
 * @param {(endpoint: string) => {request: string, response?: string} | undefined} renderEndpoint
 */
export function resolveApiComponents(body, renderEndpoint) {
  if (!/<Endpoint(Request|Response)Snippet\b/.test(body)) return body;
  const tree = processor.parse(body);
  const tags = [];
  visit(tree, 'mdxJsxFlowElement', (node) => {
    if (!SNIPPET_COMPONENTS.has(node.name)) return;
    const endpoint = attr(node, 'endpoint');
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (endpoint == null || start == null || end == null) return;
    const rendered = renderEndpoint(endpoint);
    if (rendered == null) return;
    const replacement = node.name === 'EndpointRequestSnippet' ? rendered.request : rendered.response;
    if (replacement != null) tags.push({start, end, replacement});
  });
  let out = body;
  for (const {start, end, replacement} of tags.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, start) + replacement + out.slice(end);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Relative paths -> the URLs the site serves.

/**
 * Map `../../assets/x.png` (relative to the page source) to the built
 * `/assets/images/x-<hash>.png`, matching the file name and size, and
 * `./other-page.mdx` to that page's URL.
 */
export function createAssetResolver({outDir, siteUrl, pageUrlForFile = new Map()}) {
  const byName = new Map();
  for (const sub of ['images', 'files']) {
    const dir = path.join(outDir, 'assets', sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const match = /^(.*)-[0-9a-f]{8,}(\.[^.]+)$/.exec(file);
      if (!match) continue;
      const key = `${match[1]}${match[2]}`.toLowerCase();
      const list = byName.get(key) ?? [];
      list.push({url: `${siteUrl}/assets/${sub}/${file}`, size: fs.statSync(path.join(dir, file)).size});
      byName.set(key, list);
    }
  }
  const copied = new Map();
  return (sourceFile) => (url) => {
    if (!/^\.\.?\//.test(url)) return url;
    const [clean, suffix = ''] = url.split(/(?=[?#])/);
    let absolute;
    try {
      absolute = path.resolve(path.dirname(sourceFile), decodeURI(clean));
    } catch {
      return url;
    }
    // A link to another page's source file: that page's URL, as on the site.
    if (/\.mdx?$/.test(absolute)) return pageUrlForFile.has(absolute) ? pageUrlForFile.get(absolute) + suffix : url;
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return url;
    const candidates = byName.get(path.basename(absolute).toLowerCase()) ?? [];
    const size = fs.statSync(absolute).size;
    const hit = candidates.find((c) => c.size === size) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (hit) return hit.url + suffix;
    // Small images are inlined into the HTML as data: URIs, so the build has
    // no file for them; publish a copy for the Markdown to point at.
    if (!copied.has(absolute)) {
      const data = fs.readFileSync(absolute);
      const hash = crypto.createHash('md5').update(data).digest('hex').slice(0, 8);
      const ext = path.extname(absolute);
      const name = `${path.basename(absolute, ext).replace(/[^A-Za-z0-9._-]+/g, '-')}-${hash}${ext}`;
      const target = path.join(outDir, 'assets', 'md', name);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, data);
      copied.set(absolute, `${siteUrl}/assets/md/${name}`);
    }
    return copied.get(absolute) + suffix;
  };
}

// ---------------------------------------------------------------------------
// The conversion used before the AST port; kept as the fallback.

export function simpleMdxToMarkdown(source, filePath) {
  let body = inlineSnippets(source.replace(FRONT_MATTER, ''), filePath);
  const constants = {};
  body = body.replace(/^export const (\w+)\s*=\s*(["'`])([\s\S]*?)\2;?\s*$/gm, (_, name, __, value) => {
    constants[name] = value;
    return '';
  });
  body = body
    .replace(/^export const [\s\S]*?;\s*$/gm, '')
    .replace(/^import .*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\{(\w+)\}/g, (match, name) => (name in constants ? constants[name] : match));
  return body.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Body of a docs page or changelog entry in Fern's llm format: snippets
 * inlined, API components rendered, then filterMarkdownForLlm. Falls back
 * to the simple conversion (with a warning) when the MDX does not parse.
 */
export function mdxBodyToLlmMarkdown(source, filePath, {renderEndpoint, resolveAsset} = {}) {
  const body = inlineSnippets(source.replace(FRONT_MATTER, ''), filePath);
  try {
    const resolved = renderEndpoint ? resolveApiComponents(body, renderEndpoint) : body;
    return filterMarkdownForLlm(resolved, {resolveUrl: resolveAsset?.(filePath)});
  } catch (error) {
    console.warn(`[paradex] llms: ${path.relative(process.cwd(), filePath)}: Markdown conversion failed (${error.message.split('\n')[0]}); using the simple conversion.`);
    return simpleMdxToMarkdown(source, filePath);
  }
}

/**
 * A page's .md in Fern's layout: [preamble, # title, > description, body]
 * joined by blank lines, then surfaceCodeBlockTitles().
 */
export function assemblePageMarkdown({preamble, title, description, body}) {
  return surfaceCodeBlockTitles(
    [preamble, title ? `# ${title}` : undefined, description ? blockquote(description) : undefined, body?.trim()]
      .filter(Boolean)
      .join('\n\n'),
  );
}
