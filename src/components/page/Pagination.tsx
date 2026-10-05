// Fern's previous/next bar: a compact "Previous" link and a card for the next
// page showing its title and subtitle.

import React from 'react';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import {subtitleText} from '@site/src/components/InlineMarkdown';

const Chevron = ({left}: {left?: boolean}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

export type NavLink = {title: string; permalink: string} | undefined;

function CardText({page}: {page: {title: string; permalink: string}}) {
  const {subtitles} = usePluginData('paradex-site') as {subtitles: Record<string, string>};
  const subtitle = subtitles[page.permalink];
  return (
    <span className="fern-footer-nav__text">
      <span className="fern-footer-nav__title">{page.title}</span>
      {subtitle && <span className="fern-footer-nav__subtitle">{subtitleText(subtitle)}</span>}
    </span>
  );
}

export default function Pagination({previous, next}: {previous: NavLink; next: NavLink}) {
  // With nowhere to go, Fern draws a line where the bar would be.
  if (!previous && !next) return <div className="fern-footer-separator" aria-hidden="true" />;
  return (
    <nav className="fern-footer-nav" aria-label="Up next">
      {previous && (
        <Link className="fern-footer-prev" to={previous.permalink} aria-label={`Previous: ${previous.title}`}>
          <Chevron left />
          <span className="fern-footer-nav__label">Previous</span>
        </Link>
      )}
      {next && (
        <Link className="fern-footer-next" to={next.permalink} aria-label={`Next: ${next.title}`}>
          <CardText page={next} />
          <span className="fern-footer-nav__divider" aria-hidden="true" />
          <span className="fern-footer-nav__direction">
            <span className="fern-footer-nav__label">Next</span>
            <Chevron />
          </span>
        </Link>
      )}
    </nav>
  );
}
