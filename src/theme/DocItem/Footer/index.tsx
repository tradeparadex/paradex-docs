// Page footer as on Fern: "Was this page helpful?", "Edit this page" and
// the previous/next bar.

import React, {type ReactNode} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import Feedback from '@site/src/components/page/Feedback';
import Pagination from '@site/src/components/page/Pagination';

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4" />
  </svg>
);

export default function DocItemFooter(): ReactNode {
  const {metadata} = useDoc();
  return (
    <footer className="theme-doc-footer">
      <div className="fern-footer-row">
        <Feedback permalink={metadata.permalink} />
        {metadata.editUrl && (
          <a className="fern-footer-edit" href={metadata.editUrl} target="_blank" rel="noreferrer noopener">
            <Pencil />
            Edit this page
          </a>
        )}
      </div>
      <Pagination previous={metadata.previous} next={metadata.next} />
    </footer>
  );
}
