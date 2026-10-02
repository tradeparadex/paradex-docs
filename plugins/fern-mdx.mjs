// MDX compatibility layer for content written for Fern.
//
// Fern accepted a few things that plain MDX + React do not. Rather than
// rewriting hundreds of pages, these transforms run at build time:
//
//   preprocessMarkdown  `<Markdown src="snippet.mdx" />` is inlined, so the
//                       snippet sees the parent page's `export const`
//                       variables exactly as it did under Fern.
//   remarkFernJsx       JSX attributes: `style="a: b"` becomes a style
//                       object, `class` becomes `className`, and relative
//                       `src` paths are bundled with require(). A bare
//                       `{Name}` that the page does not define renders as
//                       literal text, as Fern did (e.g. `{Expiry}`).

import fs from 'node:fs';
import path from 'node:path';
import {parseExpressionAt} from 'acorn';
import {getFileLoaderUtils} from '@docusaurus/utils';
import {visit} from 'unist-util-visit';
import {visitParents} from 'unist-util-visit-parents';
import {toString} from 'mdast-util-to-string';

const MARKDOWN_INCLUDE = /<Markdown\s+src=(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})\s*\/>/g;
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** Inline `<Markdown src>` snippets, recursively. */
export function inlineSnippets(fileContent, filePath, seen = new Set()) {
  return fileContent.replace(MARKDOWN_INCLUDE, (match, a, b, c) => {
    const target = path.resolve(path.dirname(filePath), a ?? b ?? c);
    if (seen.has(target)) {
      throw new Error(`Circular <Markdown src> include: ${target}`);
    }
    if (!fs.existsSync(target)) {
      throw new Error(`<Markdown src="${a ?? b ?? c}"> in ${filePath}: file not found`);
    }
    const snippet = fs.readFileSync(target, 'utf8').replace(FRONT_MATTER, '');
    return '\n' + inlineSnippets(snippet, target, new Set([...seen, target])) + '\n';
  });
}

export function preprocessMarkdown({filePath, fileContent}) {
  return inlineSnippets(fileContent, filePath);
}

function expressionValue(source) {
  const expression = parseExpressionAt(source, 0, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  return {
    type: 'mdxJsxAttributeValueExpression',
    value: source,
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [{type: 'ExpressionStatement', expression}],
      },
    },
  };
}

const camelCase = (prop) =>
  prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function styleObject(css) {
  const entries = css
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      return [camelCase(decl.slice(0, idx).trim()), decl.slice(idx + 1).trim()];
    });
  return JSON.stringify(Object.fromEntries(entries));
}

const BUNDLED_SRC_TAGS = new Set(['img', 'video', 'source', 'audio', 'Frame']);
// The loader Docusaurus uses for Markdown images: a URL for every file type
// (a plain require() of an .svg would return a React component).
const IMAGE_LOADER = getFileLoaderUtils(false).loaders.inlineMarkdownImageFileLoader;

const IDENTIFIER = /^\s*([A-Za-z_$][\w$]*)\s*$/;
const GLOBALS = new Set(['props', 'frontMatter', 'toc', 'contentTitle', 'metadata', 'assets', 'undefined', 'null', 'true', 'false']);

function declaredNames(tree) {
  const names = new Set(GLOBALS);
  visit(tree, 'mdxjsEsm', (node) => {
    for (const statement of node.data?.estree?.body ?? []) {
      const declaration = statement.declaration ?? statement;
      for (const d of declaration.declarations ?? []) if (d.id?.name) names.add(d.id.name);
      if (declaration.id?.name) names.add(declaration.id.name);
      for (const spec of statement.specifiers ?? []) if (spec.local?.name) names.add(spec.local.name);
    }
  });
  return names;
}

export function remarkFernJsx() {
  return (tree) => {
    const names = declaredNames(tree);
    visit(tree, ['mdxTextExpression', 'mdxFlowExpression'], (node, index, parent) => {
      const match = IDENTIFIER.exec(node.value ?? '');
      if (!match || names.has(match[1]) || !parent || index === undefined) return undefined;
      const text = {type: 'text', value: `{${match[1]}}`};
      parent.children[index] = node.type === 'mdxFlowExpression' ? {type: 'paragraph', children: [text]} : text;
      return undefined;
    });
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node) => {
      // Raw <h1>-<h6> in MDX get anchor ids, as Fern gave them.
      if (/^h[1-6]$/.test(node.name ?? '') && !node.attributes?.some((a) => a.name === 'id')) {
        const id = toString(node).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
        if (id) node.attributes = [...(node.attributes ?? []), {type: 'mdxJsxAttribute', name: 'id', value: id}];
      }
      for (const attr of node.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute') continue;
        if (attr.name === 'class') attr.name = 'className';
        if (attr.name === 'style' && typeof attr.value === 'string') {
          attr.value = expressionValue(styleObject(attr.value));
        }
        if (
          attr.name === 'src' &&
          typeof attr.value === 'string' &&
          BUNDLED_SRC_TAGS.has(node.name) &&
          /^\.\.?\//.test(attr.value)
        ) {
          attr.value = expressionValue(`require(${JSON.stringify(IMAGE_LOADER + attr.value)}).default`);
        }
      }
    });
  };
}

/**
 * Heading ids ignore leading/trailing JSX (e.g. `## <Icon /> Platform Links`
 * -> `platform-links`), as on Fern. Runs before Docusaurus' own heading-id
 * plugin, which keeps an id that is already set.
 */
export function remarkTrimHeadingIds() {
  return (tree) => {
    visit(tree, 'heading', (heading) => {
      const textNodes = heading.children.filter((child) => !['html', 'jsx', 'mdxJsxTextElement'].includes(child.type));
      const raw = toString(textNodes.length ? textNodes : heading);
      if (raw === raw.trim() || /\{#[^}]+\}\s*$/.test(raw)) return;
      const data = heading.data ?? (heading.data = {});
      const properties = data.hProperties ?? (data.hProperties = {});
      if (!properties.id) properties.id = raw.trim().toLowerCase();
    });
  };
}

/**
 * Fern leaves headings inside components (the step titles in <Steps>, the
 * headings in a <Tab>) out of "On this page". Runs after Docusaurus has
 * assigned heading ids and written the `toc` export, and drops those entries
 * from it.
 */
export function remarkTocSkipNested() {
  return (root) => {
    const nested = new Set();
    visitParents(root, 'heading', (node, ancestors) => {
      if (!ancestors.some((ancestor) => ancestor.type === 'mdxJsxFlowElement')) return;
      const id = node.data?.id ?? node.data?.hProperties?.id;
      if (id) nested.add(id);
    });
    if (!nested.size) return;
    for (const child of root.children) {
      if (child.type !== 'mdxjsEsm') continue;
      for (const statement of child.data?.estree?.body ?? []) {
        if (statement.type !== 'ExportNamedDeclaration') continue;
        for (const declaration of statement.declaration?.declarations ?? []) {
          if (declaration.id?.name !== 'toc' || declaration.init?.type !== 'ArrayExpression') continue;
          declaration.init.elements = declaration.init.elements.filter((element) => {
            if (element?.type !== 'ObjectExpression') return true;
            const idProperty = element.properties.find((p) => (p.key?.name ?? p.key?.value) === 'id');
            return !nested.has(idProperty?.value?.value);
          });
        }
      }
    }
  };
}
