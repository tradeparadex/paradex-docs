// Swizzled (ejected) from @docusaurus/theme-classic. Lays a code block out as
// Fern's card: optional title header, a height-capped scroll viewport with
// overlay scrollbars, and the flag + copy toolbar (on hover). Inside a tabbed
// group (src/components/fern/CodeBlocks.tsx) the group draws the card and the
// toolbar instead.

import React, {useCallback, useEffect, useRef, type ReactNode} from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {useCodeBlockContext} from '@docusaurus/theme-common/internal';
import Container from '@theme/CodeBlock/Container';
import Title from '@theme/CodeBlock/Title';
import Content from '@theme/CodeBlock/Content';
import type {Props} from '@theme/CodeBlock/Layout';
import CodeActions from '@site/src/components/code/CodeActions';
import OverlayScrollbars from '@site/src/components/code/OverlayScrollbars';
import {useCodeGroupPanel} from '@site/src/components/code/context';
import {normalizeLanguage} from '@site/src/components/code/refine';

export default function CodeBlockLayout({className}: Props): ReactNode {
  const {metadata, wordWrap} = useCodeBlockContext();
  const group = useCodeGroupPanel();
  const body = useRef<HTMLDivElement>(null);
  const language = normalizeLanguage(metadata.language);

  useEffect(() => {
    group?.register(metadata.code, language);
  }, [group, metadata.code, language]);

  const getCode = useCallback(() => metadata.code, [metadata.code]);
  const getLanguage = useCallback(() => language, [language]);
  const title = group ? null : metadata.title;

  return (
    <Container
      as="div"
      className={clsx(className, metadata.className, 'fern-code', group && 'fern-code--in-group', title && 'fern-code--titled')}>
      {title && (
        <div className="fern-code__header">
          <span className="fern-code__title">
            <Title>{title}</Title>
          </span>
          <BrowserOnly>{() => <CodeActions getCode={getCode} getLanguage={getLanguage} className="fern-code__actions--header" />}</BrowserOnly>
        </div>
      )}
      <div className="fern-code__body" ref={body}>
        <Content />
        <BrowserOnly>{() => <OverlayScrollbars viewport={wordWrap.codeBlockRef} root={body} />}</BrowserOnly>
        {!group && !title && (
          <BrowserOnly>{() => <CodeActions getCode={getCode} getLanguage={getLanguage} className="fern-code__actions--overlay" />}</BrowserOnly>
        )}
      </div>
    </Container>
  );
}
