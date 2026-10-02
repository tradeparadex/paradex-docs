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
import InlineMarkdown from '@site/src/components/InlineMarkdown';
import {AnchorIdProvider} from '@site/src/components/fern/anchors';

// Fern rendered a subtitle as plain text unless it held characters Markdown
// might act on (links, dashes, slashes, `$`, typographic punctuation...);
// those it rendered as a Markdown paragraph, which its theme colours grey.
const MARKDOWN_SUBTITLE = /[-$/~[\]*_`<>]|[^\x00-\x7f]/;

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
            <p className={clsx('fern-page-header__subtitle', MARKDOWN_SUBTITLE.test(fm.subtitle) && 'fern-page-header__subtitle--prose')}>
              <InlineMarkdown>{fm.subtitle}</InlineMarkdown>
            </p>
          )}
        </header>
      )}
      <AnchorIdProvider seed={toc.map((item) => item.id)}>
        <MDXContent>{children}</MDXContent>
      </AnchorIdProvider>
    </div>
  );
}
