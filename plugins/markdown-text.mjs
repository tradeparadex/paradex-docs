// Plain text from markdown, for meta tags. The description rules below are
// Fern's (fern-docs bundle, page metadata), so pages keep the same
// <meta name="description"> after the move.

export function markdownToPlainText(markdown) {
  return String(markdown)
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g, (_, a, b, c) => a ?? b ?? c)
    .replace(/\\([\\`*_{}[\]()#+\-.!$|])/g, '$1')
    .trim();
}

/**
 * Shorten text to at most `max` characters: cut at the last line break,
 * else the last sentence end, else the last space (adding "…").
 */
export function truncateDescription(text, max = 160) {
  if (!text) return undefined;
  const plain = String(text).replace(/[*_`#[\]]/g, '').trim();
  if (!plain) return undefined;
  let out = plain;
  let ellipsis = false;
  if (plain.length > max) {
    const head = plain.substring(0, max);
    const newline = head.lastIndexOf('\n');
    if (newline > 0) out = head.substring(0, newline);
    else {
      const sentence = head.match(/.*[.!?]/);
      if (sentence) out = sentence[0];
      else {
        const space = head.lastIndexOf(' ');
        out = space > 0 ? head.substring(0, space) : head;
        ellipsis = true;
      }
    }
  }
  out = out.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!out) return undefined;
  return ellipsis ? `${out}…` : out;
}

// Blocks that are not prose: headings, components, imports, quotes, tables,
// admonitions, expressions, images, lists and rules.
const NOT_PROSE = /^(#|<|import\s|export\s|>|\||:::|\{|!\[|[-*+]\s|\d+[.)]\s|(?:-{3,}|\*{3,}|_{3,})\s*$)/;

/** The page's first prose paragraph, as plain text. */
export function descriptionFromMarkdown(markdown, max = 160) {
  if (!markdown) return undefined;
  const blocks = String(markdown)
    // Front matter, including an empty one ("---\n---").
    .replace(/^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/, '')
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n[ \t]*\r?\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed === '' || NOT_PROSE.test(trimmed)) continue;
    const text = trimmed
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      .replace(/<\/?[A-Za-z][^<>]*>/g, '')
      .replace(/\{[^{}]*\}/g, '')
      .replace(/(\*\*|__|~~)(.*?)\1/g, '$2')
      .replace(/(^|[\s(])[*_]([^*_]+)[*_]/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (text !== '') return truncateDescription(text, max);
  }
  return undefined;
}
