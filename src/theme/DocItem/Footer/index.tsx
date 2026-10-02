// Page footer as on Fern: "Was this page helpful?" and "Edit this page".
// Feedback is sent to PostHog and the GTM data layer when they are loaded.

import React, {useState, type ReactNode} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import EditThisPage from '@theme/EditThisPage';

declare global {
  interface Window {
    posthog?: {capture: (event: string, properties?: Record<string, unknown>) => void};
  }
}

const ThumbUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 4 3.9z" />
  </svg>
);
const ThumbDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 14V2M9 18.1 10 14H4.2a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 5.6 3H17v11l-4 8a3 3 0 0 1-4-3.9z" />
  </svg>
);

function Feedback({permalink}: {permalink: string}) {
  const [sent, setSent] = useState(false);
  const send = (helpful: boolean) => {
    const properties = {helpful, path: permalink};
    window.posthog?.capture?.('docs_feedback', properties);
    (window as unknown as {dataLayer?: unknown[]}).dataLayer?.push({event: 'docs_feedback', ...properties});
    setSent(true);
  };
  if (sent) return <div className="doc-feedback">Thank you for your feedback!</div>;
  return (
    <div className="doc-feedback">
      <span>Was this page helpful?</span>
      <button type="button" onClick={() => send(true)}>
        <ThumbUp /> Yes
      </button>
      <button type="button" onClick={() => send(false)}>
        <ThumbDown /> No
      </button>
    </div>
  );
}

export default function DocItemFooter(): ReactNode {
  const {metadata} = useDoc();
  return (
    <footer className="theme-doc-footer">
      <Feedback permalink={metadata.permalink} />
      {metadata.editUrl && (
        <div className="theme-doc-footer-edit-meta-row">
          <EditThisPage editUrl={metadata.editUrl} />
        </div>
      )}
    </footer>
  );
}
