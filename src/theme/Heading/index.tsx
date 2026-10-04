// Content headings as on Fern: hovering one shows a link button in the left
// gutter (on phones, in the 16px kept free after the text), and a click on
// the button or the heading copies the section's link without scrolling.
// `#` headings in the content keep their ids too (the stock heading drops
// the id on h1): Fern gave them ids and pages link to them (e.g.
// /risk/cross-margin-requirement#leverage).

import React, {useState, type ReactNode} from 'react';
import clsx from 'clsx';
import {useAnchorTargetClassName} from '@docusaurus/theme-common';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import useIsBrowser from '@docusaurus/useIsBrowser';
import type {Props} from '@theme/Heading';
import {CheckIcon, LinkIcon} from '@site/src/components/api/icons';
import {isPlainClick, useCopyLink} from '@site/src/components/fern/anchors';
import {useInStepTitle} from '@site/src/components/fern/Layout';

export default function Heading({as: As, id, className, children, ...props}: Props): ReactNode {
  const brokenLinks = useBrokenLinks();
  const isBrowser = useIsBrowser();
  const anchorTargetClassName = useAnchorTargetClassName(id);
  const stepTitle = useInStepTitle() && As === 'h3';
  const [copied, copy] = useCopyLink(id);
  // Fern's button closes on a click on the heading once the tick has shown,
  // and comes back when the pointer does.
  const [dismissed, setDismissed] = useState(false);
  if (!id) {
    return (
      <As {...props} className={className}>
        {children}
      </As>
    );
  }
  brokenLinks.collectAnchor(id);
  // Server-rendered only, and hidden: the site search's indexer takes each
  // section's hash from the heading's a.hash-link (without one, a heading
  // hit opens the top of the page). Hydration swaps it for the button.
  const searchHash = !isBrowser && <a href={`#${id}`} className="hash-link" hidden aria-hidden="true" tabIndex={-1} />;
  // A step title links through its number badge instead.
  if (stepTitle) {
    return (
      <As {...props} id={id} className={clsx('anchor', anchorTargetClassName, className)}>
        {searchHash}
        {children}
      </As>
    );
  }
  return (
    <As
      {...props}
      id={id}
      className={clsx('anchor', 'fern-heading', anchorTargetClassName, className)}
      onClick={(event) => {
        // A link in the heading text navigates as usual.
        const target = event.target as Element;
        if (!isPlainClick(event) || target.closest('a:not(.fern-anchor)')) return;
        event.preventDefault();
        if (!target.closest('.fern-anchor')) setDismissed(true);
        copy();
      }}
      onMouseLeave={() => setDismissed(false)}>
      {/* Out of the tab order and the accessibility tree, as Fern's (a
          tooltip). Rendered once hydrated: it needs JS, and the changelog
          feed, made from the built HTML, stays free of icons. */}
      {searchHash}
      {isBrowser && (
        <a
          href={`#${id}`}
          className={clsx('fern-anchor', copied && 'fern-anchor--copied', dismissed && !copied && 'fern-anchor--dismissed')}
          tabIndex={-1}
          aria-hidden="true">
          <span className="fern-anchor-icon">{copied ? <CheckIcon /> : <LinkIcon />}</span>
        </a>
      )}
      {children}
    </As>
  );
}
