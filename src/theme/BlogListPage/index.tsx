// Changelog index (/releases/changelog): title with "Subscribe via RSS",
// the intro from docs/release-notes/prod/overview.mdx, ten entries per page,
// and an "On this page" list of dates and versions.

import React, {useEffect, type ReactNode} from 'react';
import {useHistory, useLocation} from '@docusaurus/router';
import clsx from 'clsx';
import {PageMetadata, HtmlClassNameProvider, ThemeClassNames} from '@docusaurus/theme-common';
import BlogLayout from '@theme/BlogLayout';
import BlogListPaginator from '@theme/BlogListPaginator';
import SearchMetadata from '@theme/SearchMetadata';
import BlogPostItems from '@theme/BlogPostItems';
import OnThisPage from '@site/src/components/page/OnThisPage';
import Heading from '@theme/Heading';
import type {Props} from '@theme/BlogListPage';
import {changelogDateId} from '@site/src/components/changelog';
import InlineMarkdown from '@site/src/components/InlineMarkdown';

const RssIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1" />
  </svg>
);

/** Fern paged the changelog with `#page-N`; those links open /page/N. */
function useFernPageHash(basePath: string): void {
  const {hash} = useLocation();
  const history = useHistory();
  useEffect(() => {
    const page = /^#page-(\d+)$/.exec(hash)?.[1];
    if (!page) return;
    history.replace(Number(page) > 1 ? `${basePath}/page/${page}` : basePath);
  }, [hash, basePath, history]);
}

export default function BlogListPage(props: Props): ReactNode {
  const {metadata, items} = props;
  useFernPageHash(metadata.permalink.replace(/\/page\/\d+$/, ''));
  const toc = items.flatMap(({content}) => {
    const {title, date} = content.metadata;
    const entries = (content as unknown as {toc?: Array<{value: string; id: string; level: number}>}).toc ?? [];
    return [
      {value: title, id: changelogDateId(date), level: 2},
      ...entries.filter((t) => t.level === 2).map((t) => ({...t, level: 3})),
    ];
  });
  return (
    <HtmlClassNameProvider className={clsx(ThemeClassNames.wrapper.blogPages, ThemeClassNames.page.blogListPage)}>
      <PageMetadata title={metadata.blogTitle} description={metadata.blogDescription} />
      <SearchMetadata tag="blog_posts_list" />
      <BlogLayout toc={<OnThisPage toc={toc} minHeadingLevel={2} maxHeadingLevel={3} backToTop={false} />}>
        <header className="changelog-header">
          <Heading as="h1">{metadata.blogTitle}</Heading>
          <a className="changelog-rss" href={`${metadata.permalink.replace(/\/page\/\d+$/, '')}/rss.xml`}>
            Subscribe via RSS <RssIcon />
          </a>
        </header>
        <p className="changelog-description">
          <InlineMarkdown>{metadata.blogDescription}</InlineMarkdown>
        </p>
        <BlogPostItems items={items} />
        <BlogListPaginator metadata={metadata} />
      </BlogLayout>
    </HtmlClassNameProvider>
  );
}
