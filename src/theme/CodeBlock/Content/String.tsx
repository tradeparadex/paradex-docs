// Swizzled (ejected) from @docusaurus/theme-classic to read Fern's code fence
// options from the metastring: `wordWrap` wraps long lines instead of
// scrolling. The class lands on the code block container (metadata.className).

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {useThemeConfig} from '@docusaurus/theme-common';
import {CodeBlockContextProvider, createCodeBlockMetadata, useCodeWordWrap} from '@docusaurus/theme-common/internal';
import type {Props} from '@theme/CodeBlock/Content/String';
import CodeBlockLayout from '@theme/CodeBlock/Layout';

function useCodeBlockMetadata(props: Props) {
  const {prism} = useThemeConfig();
  const wrap = /(^|\s)wordWrap(\s|=|$)/.test(props.metastring ?? '');
  return createCodeBlockMetadata({
    code: props.children,
    className: clsx(props.className, wrap && 'fern-code--wrap'),
    metastring: props.metastring,
    magicComments: prism.magicComments,
    defaultLanguage: prism.defaultLanguage,
    language: props.language,
    title: props.title,
    showLineNumbers: props.showLineNumbers,
  });
}

export default function CodeBlockString(props: Props): ReactNode {
  const metadata = useCodeBlockMetadata(props);
  const wordWrap = useCodeWordWrap();
  return (
    <CodeBlockContextProvider metadata={metadata} wordWrap={wordWrap}>
      <CodeBlockLayout />
    </CodeBlockContextProvider>
  );
}
