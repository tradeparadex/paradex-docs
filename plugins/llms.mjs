// AI-friendly outputs that Fern generated automatically:
//   /llms.txt               index of every page (Markdown links)
//   /llms-full.txt          every page's Markdown, concatenated
//   /<any section>/llms.txt index of the pages under that URL
//   /<page>.md              Markdown version of each page
//   /releases/changelog/llms.txt  all release notes

import fs from 'node:fs';
import path from 'node:path';

import {inlineSnippets} from './fern-mdx.mjs';
import {parseChangelogFileName} from './site.mjs';

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** MDX source -> readable Markdown (snippets inlined, exports applied). */
export function mdxToMarkdown(source, filePath) {
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

const mdList = (items) => items.map((line) => `- ${line}`).join('\n');

function shapeToMarkdown(properties = [], depth = 0) {
  const indent = '  '.repeat(depth);
  return properties
    .map(({name, required, shape}) => {
      const description = (shape.description || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      const enumValues = shape.kind === 'enum' ? ` Allowed values: ${shape.values.map((v) => `\`${v}\``).join(', ')}.` : '';
      let line = `${indent}- \`${name}\` (${shape.label}, ${required ? 'required' : 'optional'})${description ? `: ${description}` : ''}${enumValues}`;
      const nested = shape.kind === 'object' ? shape.properties : shape.kind === 'array' && shape.items?.kind === 'object' ? shape.items.properties : undefined;
      if (nested?.length && depth < 3) line += '\n' + shapeToMarkdown(nested, depth + 1);
      return line;
    })
    .join('\n');
}

export function endpointToMarkdown(data) {
  const out = [`# ${data.title}`, ''];
  if (data.kind === 'websocket') {
    out.push(`\`WSS ${data.server}${data.displayPath}\``, '');
  } else {
    out.push(`\`${data.method} ${data.server}${data.displayPath}\``, '');
  }
  if (data.descriptionMarkdown) out.push(data.descriptionMarkdown.trim(), '');
  if (data.auth) out.push('## Authentication', '', `- \`${data.auth.name}\` (header): ${data.auth.description}`, '');
  for (const [title, list] of [
    ['Path parameters', data.pathParams],
    ['Query parameters', data.queryParams],
    ['Headers', data.headerParams],
  ]) {
    if (list?.length) out.push(`## ${title}`, '', shapeToMarkdown(list), '');
  }
  const bodyProps = (shape) => (shape?.kind === 'object' ? shape.properties : shape?.kind === 'array' ? shape.items?.properties : undefined);
  if (data.requestBody) {
    out.push('## Request', '');
    const props = bodyProps(data.requestBody.shape);
    if (props?.length) out.push(shapeToMarkdown(props), '');
  }
  if (data.send) {
    out.push('## Send', '');
    const props = bodyProps(data.send.shape);
    if (props?.length) out.push(shapeToMarkdown(props), '');
  }
  if (data.receive) {
    out.push('## Receive', '');
    const props = bodyProps(data.receive.shape);
    if (props?.length) out.push(shapeToMarkdown(props), '');
  }
  for (const response of data.responses ?? []) {
    out.push(`## Response (${response.status})`, '');
    const props = bodyProps(response.shape);
    if (props?.length) out.push(shapeToMarkdown(props), '');
    if (response.example !== undefined) out.push('```json', JSON.stringify(response.example, null, 2), '```', '');
  }
  if (data.errors?.length) {
    out.push('## Errors', '', mdList(data.errors.map((e) => `${e.status} ${e.name}`)), '');
  }
  for (const sample of data.samples ?? []) {
    out.push(`### ${sample.label}`, '', '```' + sample.prism, sample.code, '```', '');
  }
  return out.join('\n').trim() + '\n';
}

const outFile = (outDir, url, ext) => path.join(outDir, `${url.replace(/^\//, '') || 'index'}${ext}`);

function write(file, content) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
}

export async function writeLlmsFiles({site, outDir, siteUrl}) {
  const docs = [];
  const apiDocs = [];
  const full = [];

  for (const [file, page] of site.pages) {
    let markdown;
    let entry;
    if (page.data) {
      markdown = endpointToMarkdown({...page.data});
      const group = page.data.kind === 'websocket' ? 'WS Endpoints' : 'REST Endpoints';
      const section = page.docId.split('/').slice(-2, -1)[0];
      entry = {url: page.url, line: `${group} > ${section} [${page.title}](${siteUrl}${page.url}.md)`};
      apiDocs.push(entry);
    } else {
      const source = fs.readFileSync(file, 'utf8');
      const fm = page.frontMatter ?? {};
      const title = fm.title ?? fm.Title ?? page.label;
      const description = fm.description ?? fm.subtitle;
      markdown = `# ${title}\n\n${description ? `${description}\n\n` : ''}${mdxToMarkdown(source, file)}\n`;
      entry = {url: page.url, line: `[${title}](${siteUrl}${page.url}.md)${description ? `: ${String(description).trim()}` : ''}`};
      docs.push(entry);
    }
    write(outFile(outDir, page.url, '.md'), markdown);
    full.push(markdown);
  }

  // Release notes.
  const changelogDir = site.changelog.dir;
  const entries = fs
    .readdirSync(changelogDir)
    .map((name) => ({name, date: parseChangelogFileName(name)}))
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date.year, b.date.month - 1, b.date.day) - new Date(a.date.year, a.date.month - 1, a.date.day));
  const changelogMarkdown = entries
    .map(({name, date}) => {
      const body = mdxToMarkdown(fs.readFileSync(path.join(changelogDir, name), 'utf8'), path.join(changelogDir, name));
      const url = `${site.changelog.url}/${date.year}/${date.month}/${date.day}`;
      write(outFile(outDir, url, '.md'), body + '\n');
      return `# ${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}\n\n${body}`;
    })
    .join('\n\n');
  write(path.join(outDir, site.changelog.url.slice(1), 'llms.txt'), `# Changelog\n\n${site.changelog.description}\n\n${changelogMarkdown}\n`);
  write(outFile(outDir, site.changelog.url, '.md'), `# Changelog\n\n${site.changelog.description}\n\n${changelogMarkdown}\n`);
  docs.push({url: site.changelog.url, line: `[Changelog](${siteUrl}${site.changelog.url}.md)`});
  docs.push({url: site.changelog.url, line: `[Changelog (all entries)](${siteUrl}${site.changelog.url}/llms.txt)`});

  const header = [
    '# Paradex | Documentation',
    '',
    '## Instructions for AI Agents',
    '',
    '- For clean Markdown of any page, append `.md` to the page URL',
    '- For section-specific indexes, append `/llms.txt` to any section URL',
    '',
  ];
  const specs = [
    '## OpenAPI Specification',
    '',
    'The raw OpenAPI specification for this API is available at:',
    `- [OpenAPI JSON](${siteUrl}/openapi.json)`,
    `- [OpenAPI YAML](${siteUrl}/openapi.yaml)`,
    '',
    '## AsyncAPI Specification',
    '',
    'The raw AsyncAPI 2.6.0 specification for the WebSocket channels is available at:',
    `- [AsyncAPI JSON](${siteUrl}/asyncapi.json)`,
    `- [AsyncAPI YAML](${siteUrl}/asyncapi.yaml)`,
    '',
  ];
  const index = (docEntries, apiEntries) =>
    [
      ...(docEntries.length ? ['## Docs', '', mdList(docEntries.map((e) => e.line)), ''] : []),
      ...(apiEntries.length ? ['## API Docs', '', mdList(apiEntries.map((e) => e.line)), ''] : []),
    ].join('\n');

  write(path.join(outDir, 'llms.txt'), [...header, index(docs, apiDocs), ...specs].join('\n'));
  write(path.join(outDir, 'llms-full.txt'), ['# Paradex | Documentation', '', ...full].join('\n\n'));

  // Section indexes: every URL prefix that has pages below it.
  const prefixes = new Set();
  for (const {url} of [...docs, ...apiDocs]) {
    const parts = url.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) prefixes.add('/' + parts.slice(0, i).join('/'));
  }
  for (const prefix of prefixes) {
    if (prefix === site.changelog.url) continue;
    const under = (e) => e.url === prefix || e.url.startsWith(prefix + '/');
    write(path.join(outDir, prefix.slice(1), 'llms.txt'), [...header, index(docs.filter(under), apiDocs.filter(under))].join('\n'));
  }
}
