// "Was this page helpful?" as on Fern. Answers go to PostHog and the GTM
// data layer when they are loaded.

import React, {useState} from 'react';

declare global {
  interface Window {
    posthog?: {capture: (event: string, properties?: Record<string, unknown>) => void};
  }
}

const ThumbUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);
const ThumbDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);

export default function Feedback({permalink}: {permalink: string}) {
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
