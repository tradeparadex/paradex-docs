// Doc page layout with Fern's layout modes (front matter `layout`):
//   guide (default)  text column + "On this page" TOC
//   reference        wide column, no TOC
//   custom           full width, no title/breadcrumbs/footer (home page)
// API reference pages use a wide two-column layout of their own.

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocItemFooter from '@theme/DocItem/Footer';
import DocItemTOCDesktop from '@theme/DocItem/TOC/Desktop';
import DocItemContent from '@theme/DocItem/Content';
import DocBreadcrumbs from '@theme/DocBreadcrumbs';
import ContentVisibility from '@theme/ContentVisibility';
import type {Props} from '@theme/DocItem/Layout';

type FernFrontMatter = {
  layout?: string;
  api_reference?: boolean;
  fern_no_sidebar?: boolean;
  hide_table_of_contents?: boolean;
};

export function useFernLayout(): 'guide' | 'reference' | 'custom' | 'api' {
  const frontMatter = useDoc().frontMatter as FernFrontMatter;
  if (frontMatter.api_reference) return 'api';
  if (frontMatter.layout === 'custom') return 'custom';
  if (frontMatter.layout === 'reference' || frontMatter.layout === 'overview') return 'reference';
  return 'guide';
}

export default function DocItemLayout({children}: Props): ReactNode {
  const {frontMatter, toc, metadata} = useDoc();
  const fm = frontMatter as FernFrontMatter;
  const layout = useFernLayout();
  // Fern keeps the guide layout's TOC column even when the page has no
  // headings, so the text column sits in the same place on every guide page,
  // but hides it with the sidebar in a single-page tab (the column is then
  // centred in the window). It is always rendered and CSS shows it from
  // 1280px: the server doesn't know the window size, so its HTML must suit
  // every width. Narrower windows get no TOC at all, as on Fern.
  const tocColumn = layout === 'guide' && !fm.fern_no_sidebar;
  const showToc = tocColumn && !fm.hide_table_of_contents && toc.length > 0;

  return (
    <div
      className={clsx(
        'doc-layout',
        tocColumn && 'doc-layout--with-toc',
        `doc-layout--${layout}`,
        fm.fern_no_sidebar && 'doc-layout--no-sidebar',
      )}>
      <div className="doc-layout__main">
        <ContentVisibility metadata={metadata} />
        <div className="doc-item-container">
          <article>
            {layout !== 'custom' && <DocBreadcrumbs />}
            <DocItemContent>{children}</DocItemContent>
            {layout !== 'custom' && <DocItemFooter />}
          </article>
        </div>
      </div>
      {tocColumn && <div className="doc-layout__toc">{showToc && <DocItemTOCDesktop />}</div>}
    </div>
  );
}
