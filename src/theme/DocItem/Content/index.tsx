// Page header as on Fern: title, optional subtitle, and the "Copy page" menu.
// The title always comes from front matter (or the sidebar label), even when
// the content has its own `#` heading.

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import type {Props} from '@theme/DocItem/Content';
import PageActions from '@site/src/components/PageActions';
import InlineMarkdown, {isMarkdownSubtitle} from '@site/src/components/InlineMarkdown';
import {AnchorIdProvider} from '@site/src/components/fern/anchors';

export default function DocItemContent({children}: Props): ReactNode {
  const {metadata, frontMatter, toc} = useDoc();
  const fm = frontMatter as {layout?: string; subtitle?: string; hide_title?: boolean};
  const isCustom = fm.layout === 'custom';

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {!isCustom && !fm.hide_title && (
        <header className="fern-page-header">
          <div className="fern-page-header__row">
            <Heading as="h1">{metadata.title}</Heading>
            <PageActions permalink={metadata.permalink} />
          </div>
          {fm.subtitle && (
            // A Markdown subtitle is a paragraph, which Fern's theme colours grey.
            <p className={clsx('fern-page-header__subtitle', isMarkdownSubtitle(fm.subtitle) && 'fern-page-header__subtitle--prose')}>
              {isMarkdownSubtitle(fm.subtitle) ? <InlineMarkdown>{fm.subtitle}</InlineMarkdown> : fm.subtitle}
            </p>
          )}
        </header>
      )}
      <AnchorIdProvider seed={toc.map((item) => item.id)}>
        <MDXContent>{children}</MDXContent>
      </AnchorIdProvider>
      {/* Infima zeroes the last child's bottom margin; Fern keeps the closing
          block's margin (a list's 12px, Steps' 48px) above the footer, so an
          empty block takes the last place. */}
      <div className="theme-doc-markdown__end" />
    </div>
  );
}
