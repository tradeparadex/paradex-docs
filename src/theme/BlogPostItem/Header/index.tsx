// A changelog entry is headed by its date (as a pill), like on Fern. On an
// entry's own page, a "‹ Changelog" title links back to the index.

import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import {usePluginData} from '@docusaurus/useGlobalData';
import Heading from '@theme/Heading';
import {changelogDateId} from '@site/src/components/changelog';

export default function BlogPostItemHeader(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  const {changelogUrl} = usePluginData('paradex-site') as {changelogUrl: string};
  const id = changelogDateId(metadata.date);
  return (
    <header className="changelog-entry__header">
      {isBlogPostPage && (
        <Heading as="h1" className="changelog-back">
          <Link to={changelogUrl} aria-label="Back to the changelog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Changelog
          </Link>
        </Heading>
      )}
      {/* The date links to the entry, on its own page too (as on Fern). */}
      <Link className="changelog-date" id={isBlogPostPage ? undefined : id} to={metadata.permalink}>
        <time dateTime={metadata.date}>{metadata.title}</time>
      </Link>
    </header>
  );
}
