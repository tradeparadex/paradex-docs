// Renders the inline Markdown Fern allowed in front matter (e.g. a page
// subtitle): links, **bold**, *emphasis*, `code` and backslash escapes, with
// smart quotes as in the page body.

import React from 'react';
import Link from '@docusaurus/Link';

const TOKEN = /\\([\\`*_{}[\]()#+\-.!$|])|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

/** Straight quotes to typographic ones, as remark-smartypants does. */
export function smartQuotes(text: string): string {
  return text
    .replace(/(^|[\s([{])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{])'/g, '$1‘')
    .replace(/'/g, '’');
}

export default function InlineMarkdown({children}: {children: string}): React.JSX.Element {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of children.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(smartQuotes(children.slice(last, index)));
    const [, escaped, linkText, href, bold, em, code] = match;
    if (escaped !== undefined) out.push(escaped);
    else if (linkText !== undefined) {
      out.push(
        <Link key={key++} to={href}>
          <InlineMarkdown>{linkText}</InlineMarkdown>
        </Link>,
      );
    } else if (bold !== undefined) out.push(<strong key={key++}>{smartQuotes(bold)}</strong>);
    else if (em !== undefined) out.push(<em key={key++}>{smartQuotes(em)}</em>);
    else if (code !== undefined) out.push(<code key={key++}>{code}</code>);
    last = index + match[0].length;
  }
  if (last < children.length) out.push(smartQuotes(children.slice(last)));
  return <>{out}</>;
}
