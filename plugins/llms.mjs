// Agent-facing outputs, written after the build. They reproduce what Fern
// served for docs.paradex.trade (fern-docs bundle: the llms.txt and
// markdown routes); headers, content negotiation, ?lang=/?excludeSpec=,
// not-found answers and the MCP server itself live in the edge layer
// (edge/), which serves these files.
//
//   /<page>.md              every page in Fern's "llm" format: the agent
//                           preamble blockquote, `# title`, the front-matter
//                           description as a blockquote, then the body with
//                           MDX components turned into Markdown
//                           (plugins/llms-markdown.mjs). REST endpoint and
//                           WebSocket pages use Fern's API layout
//                           (plugins/llms-api.mjs, which documents the markers
//                           the edge filters on). Changelog entries too.
//   /<tab or section>.md    copy of the .md of the page the URL redirects to
//                           (/docs.md, /api/prod.md, /releases.md, ...).
//   /releases/changelog.md  the overview plus the 20 newest entries.
//   /llms.txt               index of every page (Markdown links), with the
//                           "Instructions for AI Agents" block.
//   /<url>/llms.txt         for every tab, section, API group and page URL,
//                           in Fern's non-root format: preamble, `# title` (or
//                           the page's own Markdown), `## Docs`, `## API Docs`
//                           and the spec links when the subtree has endpoints;
//                           the changelog's lists its entries (`## Entries`).
//   /llms-full.txt          every docs and API page's Markdown, concatenated
//                           (without preambles). Kept on purpose: Fern now
//                           redirects this URL to /llms.txt.
//   /_mcp/search-index.json the index the edge MCP server searches
//                           (plugins/llms-search.mjs).
//   /.well-known/api-catalog  RFC 9727 linkset of the REST API references.
//
// The MCP lines (root instructions bullet and the third preamble line) are
// written unless the build runs with DOCS_MCP_SERVER=off, for a deploy
// without the edge layer (edge/worker.mjs), which serves /_mcp/server.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import {createApiMarkdown} from './llms-api.mjs';
import {
  FRONT_MATTER,
  agentPreamble,
  assemblePageMarkdown,
  createAssetResolver,
  mcpEnabled,
  mdxBodyToLlmMarkdown,
  surfaceCodeBlockTitles,
  blockquote,
} from './llms-markdown.mjs';
import {buildNavTree, hasMarkdown, isApiLeaf, isPage, llmsTxtNodeFor} from './llms-nav.mjs';
import {buildSearchIndex} from './llms-search.mjs';

const mdList = (items) => items.map((line) => `- ${line}`).join('\n');

function frontMatterOf(file) {
  const match = FRONT_MATTER.exec(fs.readFileSync(file, 'utf8'));
  if (!match) return {};
  try {
    return yaml.load(match[0].replace(/^\uFEFF?---\r?\n/, '').replace(/---[ \t]*(?:\r?\n)?$/, '')) ?? {};
  } catch {
    return {};
  }
}

const outFile = (outDir, url, ext) => path.join(outDir, `${url.replace(/^\//, '') || 'index'}${ext}`);

function write(file, content) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
}

const NOTE =
  '> **Note:** This page contains both a page directory (above) and the landing page content (below). The page directory is generated for agent use and does not appear on the landing page.\n\n';

export async function writeLlmsFiles({site, outDir, siteUrl}) {
  const mcp = mcpEnabled();
  const preamble = agentPreamble(siteUrl, {mcp});
  const tree = buildNavTree(site);
  const api = createApiMarkdown({specs: site.api.specs});
  const resolveAsset = createAssetResolver({outDir, siteUrl, pageUrlForFile: new Map([...site.pages].map(([file, page]) => [file, page.url]))});
  const renderEndpoint = (endpoint) => {
    const page = site.api.findOperation(endpoint);
    return page ? api.snippetMarkdown(page) : undefined;
  };

  // ---- Markdown of every page node, without the preamble ------------------
  /** node -> {title, description, body, markdown} (markdown has no preamble) */
  const content = new Map();
  const frontMatter = new Map();
  const fmOf = (file) => {
    if (!frontMatter.has(file)) frontMatter.set(file, fs.existsSync(file) ? frontMatterOf(file) : {});
    return frontMatter.get(file);
  };

  function docContent(node, fallbackTitle) {
    const fm = fmOf(node.file);
    const source = fs.readFileSync(node.file, 'utf8');
    const body = mdxBodyToLlmMarkdown(source, node.file, {renderEndpoint, resolveAsset});
    // Fern took the H1 from front matter only; pages without one get the
    // navigation title, unless the body already opens with its own `#`.
    const ownTitle = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : undefined;
    const title = ownTitle ?? (/^# /.test(body) ? undefined : fallbackTitle);
    const description = typeof fm.description === 'string' && fm.description.trim() ? fm.description.trim() : undefined;
    return {title, description, body};
  }

  function contentOf(node) {
    if (content.has(node)) return content.get(node);
    let result;
    if (isApiLeaf(node)) {
      const referenceUrl = `${siteUrl}${node.canonicalUrl ?? node.url}`;
      const markdown = node.type === 'webSocket' ? api.websocketMarkdown(node.page, {referenceUrl}) : api.endpointMarkdown(node.page, {referenceUrl});
      result = {markdown, withPreamble: `${preamble}\n\n${markdown}`};
    } else if (node.type === 'page' || node.type === 'section' || node.type === 'changelogEntry') {
      const parts = docContent(node, node.title);
      result = {
        ...parts,
        markdown: assemblePageMarkdown({...parts}),
        withPreamble: assemblePageMarkdown({preamble, ...parts}),
      };
    } else if (node.type === 'changelog') {
      result = changelogContent(node);
    }
    content.set(node, result);
    return result;
  }

  /** Fern's changelog markdown: overview, 20 newest entries, trailer. */
  function changelogContent(node) {
    const blocks = [];
    if (node.overviewFile) {
      const parts = docContent({file: node.overviewFile}, undefined);
      blocks.push([`# ${parts.title ?? node.title}`, parts.description ? blockquote(parts.description) : undefined, parts.body || undefined].filter(Boolean).join('\n\n'));
    } else blocks.push(`# ${node.title}`);
    const entries = node.children.filter((c) => c.type === 'changelogEntry' && !c.hidden);
    const shown = entries.slice(0, 20);
    for (const entry of shown) {
      const parts = docContent(entry, entry.title);
      blocks.push([`## ${parts.title ?? entry.title}`, parts.description ? blockquote(parts.description) : undefined, parts.body || undefined].filter(Boolean).join('\n\n'));
    }
    if (shown.length > 0 && shown.length < entries.length) {
      blocks.push(`_Showing the ${shown.length} most recent of ${entries.length} entries. Append \`/llms.txt\` to the changelog URL for the complete index._`);
    }
    return {
      markdown: surfaceCodeBlockTitles(blocks.join('\n\n')),
      withPreamble: surfaceCodeBlockTitles([preamble, ...blocks].join('\n\n')),
    };
  }

  // ---- <url>.md for every page -------------------------------------------
  const written = new Set();
  for (const node of tree.nodes) {
    if (!isPage(node) || written.has(node.url)) continue;
    const result = contentOf(node);
    if (!result) continue;
    // No trailing newline: Fern's route answered the joined blocks as-is.
    write(outFile(outDir, node.url, '.md'), result.withPreamble);
    written.add(node.url);
  }

  // Tab, section and API group URLs redirect to a page; their .md is that
  // page's (Fern followed the redirect and answered 200).
  const mdFor = (url) => {
    const seen = new Set();
    let current = url;
    while (current && !seen.has(current)) {
      seen.add(current);
      if (written.has(current)) return fs.readFileSync(outFile(outDir, current, '.md'), 'utf8');
      current = site.implicitRedirects.get(current);
    }
    return undefined;
  };
  for (const from of site.implicitRedirects.keys()) {
    if (written.has(from)) continue;
    const markdown = mdFor(from);
    if (markdown != null) write(outFile(outDir, from, '.md'), markdown);
  }

  // ---- Root /llms.txt (unchanged from the Fern-parity version) ------------
  const docs = [];
  const apiDocs = [];
  const full = [];
  const listedEndpoints = new Set();
  const groupOrder = new Map();
  const nodeByUrl = new Map(tree.nodes.filter((n) => n.page).map((n) => [n.page.url, n]));
  for (const [, page] of site.pages) {
    const node = nodeByUrl.get(page.url);
    if (page.data) {
      const kind = page.data.kind === 'websocket' ? 'WS Endpoints' : 'REST Endpoints';
      const groupKey = `${page.api} ${page.group}`;
      if (!groupOrder.has(groupKey)) groupOrder.set(groupKey, groupOrder.size);
      const entry = {url: page.url, line: `${kind} > ${page.group} [${page.title}](${siteUrl}${page.url}.md)`, group: groupOrder.get(groupKey)};
      const key = `${kind} ${page.relativeUrl}`;
      if (!listedEndpoints.has(key)) {
        listedEndpoints.add(key);
        apiDocs.push(entry);
      }
    } else {
      const fm = page.frontMatter ?? {};
      const title = fm.title ?? page.title ?? page.label;
      const description = fm.description ?? fm.subtitle;
      docs.push({url: page.url, line: `[${title}](${siteUrl}${page.url}.md)${description ? `: ${String(description).trim()}` : ''}`});
    }
    if (node) full.push(contentOf(node).markdown);
  }
  docs.push({url: site.changelog.url, line: `[Changelog](${siteUrl}${site.changelog.url}.md)`});
  docs.push({url: site.changelog.url, line: `[Changelog (all entries)](${siteUrl}${site.changelog.url}/llms.txt)`});
  apiDocs.sort((a, b) => a.group - b.group);

  const header = [
    '# Paradex | Documentation',
    '',
    '## Instructions for AI Agents',
    '',
    '- For clean Markdown of any page, append `.md` to the page URL',
    '- For section-specific indexes, append `/llms.txt` to any section URL',
    ...(mcp ? [`- For AI client integration (Claude Code, Cursor, etc.), connect to the MCP server at ${siteUrl}/_mcp/server`] : []),
    '',
  ];
  // Fern says "OpenAPI 3.1"; the spec served here is the 3.0 source.
  const openApiBlock = [
    '## OpenAPI Specification',
    '',
    'The raw OpenAPI specification for this API is available at:',
    `- [OpenAPI JSON](${siteUrl}/openapi.json)`,
    `- [OpenAPI YAML](${siteUrl}/openapi.yaml)`,
    '',
  ];
  const asyncApiBlock = [
    '## AsyncAPI Specification',
    '',
    'The raw AsyncAPI 2.6.0 specification for the WebSocket channels is available at:',
    `- [AsyncAPI JSON](${siteUrl}/asyncapi.json)`,
    `- [AsyncAPI YAML](${siteUrl}/asyncapi.yaml)`,
    '',
  ];
  const rootIndex = [
    ...(docs.length ? ['## Docs', '', mdList(docs.map((e) => e.line)), ''] : []),
    ...(apiDocs.length ? ['## API Docs', '', mdList(apiDocs.map((e) => e.line)), ''] : []),
  ].join('\n');
  write(path.join(outDir, 'llms.txt'), [...header, rootIndex, ...openApiBlock, '', ...asyncApiBlock].join('\n'));
  write(path.join(outDir, 'llms-full.txt'), `# Paradex | Documentation\n\n${full.join('\n\n')}\n`);

  // ---- <url>/llms.txt for every other node (Fern's non-root format) -------
  const llmsLine = (node) => {
    // getLlmTxtMetadata: front-matter title, else the node title;
    // description ?? og:description ?? subtitle ?? headline ?? excerpt.
    const file = node.type === 'changelog' ? node.overviewFile : node.file;
    const fm = file ? fmOf(file) : {};
    const title = fm.title != null ? String(fm.title) : node.title;
    const raw = fm.description ?? fm['og:description'] ?? fm.subtitle ?? fm.headline ?? fm.excerpt;
    const description = raw != null && String(raw).trim() !== '' ? String(raw).trim() : undefined;
    return `- [${title}](${siteUrl}${node.url}.md)${description != null ? `: ${description}` : ''}\n`;
  };
  /** Fern's S(): the page's subtitle ?? description, whitespace collapsed. */
  const ownDescription = (node) => {
    if (!isPage(node) || isApiLeaf(node)) return undefined;
    const file = node.type === 'changelog' ? node.overviewFile : node.file;
    if (!file) return undefined;
    const fm = fmOf(file);
    const value = (typeof fm.subtitle === 'string' ? fm.subtitle : undefined) ?? (typeof fm.description === 'string' ? fm.description : undefined);
    return value?.replace(/\s+/g, ' ').trim() || undefined;
  };

  function sectionLlmsTxt(s) {
    let same;
    if (!isPage(s)) {
      const candidate = tree.slugMap.get(s.url);
      if (candidate != null && isPage(candidate) && candidate !== s && candidate.type !== 'changelog') same = candidate;
    }
    const own = s.type === 'changelog' ? undefined : isPage(s) ? s : undefined;
    const pageNode = own ?? (same != null && !same.hidden ? same : undefined);
    const page = pageNode ? contentOf(pageNode)?.withPreamble : undefined;
    let out = '';
    if (page != null && same == null) out += page + '\n\n';
    else out += `${preamble}\n\n# ${s.title}\n\n`;
    const description = ownDescription(s);
    if (description) out += `> ${description}\n\n`;

    const listed = new Set();
    const docEntries = [];
    const apiEntries = [];
    const traverse = (node, parents) => {
      let action = 'continue';
      if ((own != null && node === own) || (same != null && node === same)) action = 'continue';
      else if (node.type === 'changelog' && node.url !== s.url) {
        if (!node.hidden) {
          if (node.overviewFile && !listed.has(node.url)) {
            listed.add(node.url);
            docEntries.push(llmsLine(node));
          }
          const href = `${siteUrl}${node.url}/llms.txt`;
          if (!listed.has(href)) {
            listed.add(href);
            docEntries.push(`- [${node.overviewFile ? `${node.title} (all entries)` : node.title}](${href})\n`);
          }
        }
        action = 'skip';
      } else if (node.type === 'changelogEntry' && [...parents].reverse().find((p) => p.type === 'changelog')?.url !== s.url) {
        action = 'skip';
      } else if (node.hidden) {
        action = isPage(node) ? 'skip' : 'continue';
      } else {
        if (hasMarkdown(node) && !listed.has(node.url)) {
          listed.add(node.url);
          docEntries.push(llmsLine(node));
        }
        if (isApiLeaf(node)) {
          const slug = node.canonicalUrl ?? node.url;
          if (!listed.has(slug)) {
            listed.add(slug);
            const from = parents.findLastIndex((p) => p.type === 'apiReference');
            const breadcrumb = parents.slice(from).filter((p) => p.title != null && p.url != null).map((p) => p.title);
            apiEntries.push({line: `- ${breadcrumb.join(' > ')} [${node.title}](${siteUrl}${slug}.md)`, kind: node.type});
          }
        }
      }
      if (action === 'skip') return;
      for (const child of node.children ?? []) traverse(child, [...parents, node]);
    };
    // Fern's traverseDF starts with no parents at the requested node, so a
    // package-level file's breadcrumb is just the package (`- Orders [...]`).
    traverse(s, []);

    if (docEntries.length > 0) out += s.type === 'changelog' ? '## Entries\n\n' : '## Docs\n\n';
    out += docEntries.join('');
    if (apiEntries.length > 0) out += '\n## API Docs\n\n' + apiEntries.map((e) => e.line).join('\n');
    if (apiEntries.some((e) => e.kind === 'endpoint')) out += '\n\n' + openApiBlock.slice(0, -1).join('\n') + '\n';
    if (apiEntries.some((e) => e.kind === 'webSocket')) out += '\n\n' + asyncApiBlock.slice(0, -1).join('\n') + '\n';
    if (page != null && same != null) out += '\n\n' + NOTE + page + '\n';
    return out;
  }

  for (const url of tree.slugMap.keys()) {
    const node = llmsTxtNodeFor(tree, url);
    if (node == null) continue;
    write(path.join(outDir, url.replace(/^\//, ''), 'llms.txt'), sectionLlmsTxt(node));
  }

  // ---- /_mcp/search-index.json -------------------------------------------
  const titleOf = (node) => {
    if (isApiLeaf(node)) return node.title;
    const file = node.type === 'changelog' ? node.overviewFile : node.file;
    const fm = file ? fmOf(file) : {};
    return typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : node.title;
  };
  const introOf = (node) => {
    if (node.type === 'changelog') return node.overviewFile ? docContent({file: node.overviewFile}).body : undefined;
    const file = node.file;
    if (!file) return undefined;
    const fm = fmOf(file);
    return [fm.subtitle, fm.description].filter((v) => typeof v === 'string' && v.trim()).filter((v, i, a) => a.indexOf(v) === i).join('\n') || undefined;
  };
  const index = buildSearchIndex({tree, outDir, siteUrl, titleOf, introOf, apiSections: (page) => api.searchSections(page)});
  write(path.join(outDir, '_mcp', 'search-index.json'), JSON.stringify(index));

  // ---- /.well-known/api-catalog (RFC 9727) --------------------------------
  // One entry per REST API reference; the YAML names follow Fern's slug map
  // (title lowercased, non-alphanumerics -> "-", repeats suffixed -2, -3).
  const used = new Map();
  const linkset = [];
  for (const node of tree.nodes) {
    if (node.type !== 'apiReference' || node.apiType !== 'openapi' || node.hidden) continue;
    if (!node.children.some((g) => g.children.some((leaf) => leaf.type === 'endpoint'))) continue;
    const base = node.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const name = count === 1 ? base : `${base}-${count}`;
    if (!fs.existsSync(path.join(outDir, 'openapi', `${name}.yaml`))) continue;
    const anchor = `${siteUrl}${node.url}`;
    linkset.push({
      anchor,
      'service-desc': [{href: `${siteUrl}/openapi/${name}.yaml`, type: 'application/yaml'}],
      'service-doc': [{href: anchor, type: 'text/html'}],
    });
  }
  write(path.join(outDir, '.well-known', 'api-catalog'), JSON.stringify({linkset}));
}
