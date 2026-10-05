// Changelog entry footer: feedback on an entry's own page, nothing in lists.

import React, {type ReactNode} from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import Feedback from '@site/src/components/page/Feedback';

export default function BlogPostItemFooter(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  if (!isBlogPostPage) return null;
  return (
    <footer className="theme-doc-footer changelog-footer">
      <div className="fern-footer-row">
        <Feedback permalink={metadata.permalink} />
      </div>
    </footer>
  );
}
