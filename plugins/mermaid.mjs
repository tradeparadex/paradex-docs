// Mermaid diagrams are rendered to SVG at build time with beautiful-mermaid
// (in plugins/mermaid-render.mjs), the renderer Fern used, so the layout and
// styling match Fern's and no Mermaid runtime ships to the browser.
// <MermaidDiagram> shows the SVG and opens it enlarged on click.

import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {visit} from 'unist-util-visit';

const RENDER_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mermaid-render.mjs');

// Fern's palette (Tailwind slate), on a transparent background.
const THEME = {
  bg: '#0f172a',
  fg: '#f1f5f9',
  surface: '#1e293b',
  border: '#475569',
  line: '#94a3b8',
  accent: '#94a3b8',
  muted: '#94a3b8',
  transparent: true,
};

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Mermaid source -> self-contained SVG markup (ids made unique per diagram). */
export function renderDiagram(source) {
  const id = `mermaid-static-${hash(source)}`;
  const kind = /^\s*(\w+)/.exec(source)?.[1] ?? 'diagram';
  return execFileSync(process.execPath, [RENDER_SCRIPT], {input: JSON.stringify({source, theme: THEME}), encoding: 'utf8'})
    .replace(/\s*@import url\([^)]*\);/, '')
    .replace(/text \{ font-family:[^}]*\}/, 'text { font-family: inherit; }')
    .replace(/id="([^"]+)"/g, `id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace('<svg ', `<svg id="${id}" data-mermaid-kind="${kind}" role="img" `);
}

export function remarkMermaidStatic() {
  return (root) => {
    visit(root, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent || index === undefined) return;
      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'MermaidDiagram',
        attributes: [{type: 'mdxJsxAttribute', name: 'svg', value: renderDiagram(node.value)}],
        children: [],
      };
    });
  };
}
