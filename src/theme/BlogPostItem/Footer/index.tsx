// Changelog entry footer: feedback on an entry's own page, nothing in lists.

import React, {useState, type ReactNode} from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';

export default function BlogPostItemFooter(): ReactNode {
  const {metadata, isBlogPostPage} = useBlogPost();
  const [sent, setSent] = useState(false);
  if (!isBlogPostPage) return null;
  const send = (helpful: boolean) => {
    const properties = {helpful, path: metadata.permalink};
    (window as unknown as {posthog?: {capture: (e: string, p: object) => void}}).posthog?.capture?.('docs_feedback', properties);
    (window as unknown as {dataLayer?: unknown[]}).dataLayer?.push({event: 'docs_feedback', ...properties});
    setSent(true);
  };
  return (
    <footer className="doc-feedback">
      {sent ? (
        'Thank you for your feedback!'
      ) : (
        <>
          <span>Was this page helpful?</span>
          <button type="button" onClick={() => send(true)}>
            Yes
          </button>
          <button type="button" onClick={() => send(false)}>
            No
          </button>
        </>
      )}
    </footer>
  );
}
