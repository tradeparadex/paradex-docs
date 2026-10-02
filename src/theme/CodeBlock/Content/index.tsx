// Swizzled (ejected) from @docusaurus/theme-classic. Renders lines the way
// Fern did: a gutter with line numbers on every block with a language, a `$`
// prompt on shell blocks (`>` on continuation lines), and token types refined
// so the Prism theme reproduces Fern's Shiki colors.

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {usePrismTheme} from '@docusaurus/theme-common';
import {useCodeBlockContext} from '@docusaurus/theme-common/internal';
import {Highlight, type Token} from 'prism-react-renderer';
import type {Props} from '@theme/CodeBlock/Content';
import {cliPrefixes, hasCliGutter, isPlainText, normalizeLanguage, refineTokens} from '@site/src/components/code/refine';

export default function CodeBlockContent({className}: Props): ReactNode {
  const {metadata, wordWrap} = useCodeBlockContext();
  const prismTheme = usePrismTheme();
  const {code, lineNumbersStart, lineClassNames} = metadata;
  const language = normalizeLanguage(metadata.language);
  const gutter = !isPlainText(language) || lineNumbersStart !== undefined;
  const prefixes = gutter && hasCliGutter(metadata.language) ? cliPrefixes(code) : null;
  const firstNumber = lineNumbersStart ?? 1;

  return (
    <Highlight theme={prismTheme} code={code} language={language}>
      {({className: prismClassName, tokens, getTokenProps}) => {
        const lines = refineTokens(tokens as Token[][], language, code);
        const digits = String(firstNumber + lines.length - 1).length;
        return (
          <pre
            ref={wordWrap.codeBlockRef as React.RefObject<HTMLPreElement>}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className={clsx(className, prismClassName, 'fern-code__viewport')}>
            <code
              className={clsx('fern-code__lines', gutter && 'fern-code__lines--gutter', prefixes && 'fern-code__lines--cli')}
              style={
                {
                  '--fern-code-gutter-width': `${digits}ch`,
                  counterReset: gutter && !prefixes ? `fern-code-line ${firstNumber - 1}` : undefined,
                } as React.CSSProperties
              }>
              {lines.map((line, i) => (
                <span key={i} className={clsx('fern-code__line', lineClassNames[i])} data-line-prefix={prefixes?.[i]}>
                  <span className="fern-code__line-content">
                    {line.map((token, key) => (token.empty ? null : <span key={key} {...getTokenProps({token})} />))}
                    <br />
                  </span>
                </span>
              ))}
            </code>
          </pre>
        );
      }}
    </Highlight>
  );
}
