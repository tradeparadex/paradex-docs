// Page footer as on Fern: "Was this page helpful?", "Edit this page" and
// the previous/next bar. Feedback is sent to PostHog and the GTM data layer
// when they are loaded.

import React, {useState, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useDoc} from '@docusaurus/plugin-content-docs/client';

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

const Chevron = ({left}: {left?: boolean}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);
const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4" />
  </svg>
);

type NavLink = {title: string; permalink: string} | undefined;

/** Fern's bar: a compact "Previous" next to a card for the next page. */
function Pagination({previous, next}: {previous: NavLink; next: NavLink}) {
  if (!previous && !next) return null;
  return (
    <nav className="fern-footer-nav" aria-label="Docs pages">
      {previous && next && (
        <Link className="fern-footer-prev" to={previous.permalink} aria-label={`Previous: ${previous.title}`}>
          <Chevron left />
          <span className="fern-footer-nav__label">Previous</span>
        </Link>
      )}
      {next ? (
        <Link className="fern-footer-next" to={next.permalink} aria-label={`Next: ${next.title}`}>
          <span className="fern-footer-nav__title">{next.title}</span>
          <span className="fern-footer-nav__divider" aria-hidden="true" />
          <span className="fern-footer-nav__direction">
            <span className="fern-footer-nav__label">Next</span>
            <Chevron />
          </span>
        </Link>
      ) : (
        previous && (
          <Link className="fern-footer-next fern-footer-next--previous" to={previous.permalink} aria-label={`Previous: ${previous.title}`}>
            <span className="fern-footer-nav__direction">
              <Chevron left />
              <span className="fern-footer-nav__label">Previous</span>
            </span>
            <span className="fern-footer-nav__divider" aria-hidden="true" />
            <span className="fern-footer-nav__title">{previous.title}</span>
          </Link>
        )
      )}
    </nav>
  );
}

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
