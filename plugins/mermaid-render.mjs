// Child process for plugins/mermaid.mjs: reads {source, theme} as JSON on
// stdin and prints the SVG. beautiful-mermaid is ESM-only, and the MDX loader
// runs plugins where native import() is unavailable.
import {renderMermaidSVG} from 'beautiful-mermaid';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
const {source, theme} = JSON.parse(input);
process.stdout.write(renderMermaidSVG(source, theme));
