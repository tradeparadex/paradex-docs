// "On this page" as on Fern: a title, a rail whose highlighted segment spans
// the sections currently on screen, the current section in bold, and
// "Scroll to top" once scrolled a screen down. Used by docs pages and the
// changelog.

import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import {ThemeClassNames} from '@docusaurus/theme-common';
import TOCItems from '@theme/TOCItems';
import type {TOCItem} from '@docusaurus/mdx-loader';
import {decodeHash} from '@site/src/components/fern/anchors';

const ACTIVE = 'table-of-contents__link--active';
// A section becomes current once its heading is this close to the header,
// as on Fern (Docusaurus switches as soon as it reaches mid-screen).
const ACTIVE_OFFSET = 32;
// After a jump to an anchor, Fern shows only the target for this long and
// ignores the scroll the jump itself causes.
const PIN_MS = 500;

const ArrowUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 7-7 7 7M12 19V5" />
  </svg>
);

/** Marks entry `current` and draws the rail over entries `first`..`last`. */
function paint(list: HTMLElement, links: HTMLAnchorElement[], first: number, last: number, current: number) {
  links.forEach((link, i) => link.classList.toggle(ACTIVE, i === current));
  const a = links[first].closest('li')!;
  const b = links[last].closest('li')!;
  const listTop = list.getBoundingClientRect().top;
  const from = a.getBoundingClientRect().top - listTop;
  const to = b.getBoundingClientRect().top - listTop + links[last].getBoundingClientRect().height;
  list.style.setProperty('--toc-range-top', `${from}px`);
  list.style.setProperty('--toc-range-height', `${to - from}px`);
}

function tocParts(container: HTMLElement) {
  const list = container.querySelector<HTMLElement>('.table-of-contents');
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.table-of-contents__link'));
  return list && links.length ? {list, links} : null;
}

/**
 * Positions the rail highlight over the TOC entries whose sections are
 * visible, and marks the current section: the last one whose heading has
 * reached the header. Right after a jump to an anchor, only the target is
 * marked until the reader scrolls on, as on Fern.
 */
function useVisibleRange(root: React.RefObject<HTMLDivElement | null>) {
  const pinUntil = useRef(0);
  const {hash, key} = useLocation();

  useEffect(() => {
    const container = root.current;
    if (!container) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < pinUntil.current) return;
      // Hidden below the desktop breakpoint (the column is still rendered):
      // nothing to paint. The resize listener repaints once it shows.
      if (container.offsetParent === null) return;
      const parts = tocParts(container);
      if (!parts) return;
      const {list, links} = parts;
      const headings = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
      const top = document.querySelector('.navbar')?.getBoundingClientRect().bottom ?? 0;
      const bottom = window.innerHeight;
      const end = document.querySelector('.theme-doc-markdown, .changelog-main')?.getBoundingClientRect().bottom ?? Infinity;
      let first = -1;
      let last = -1;
      let current = 0;
      headings.forEach((heading, i) => {
        if (!heading) return;
        const start = heading.getBoundingClientRect().top;
        if (start <= top + ACTIVE_OFFSET) current = i;
        const next = headings.slice(i + 1).find(Boolean);
        const stop = next ? next.getBoundingClientRect().top : end;
        if (stop > top && start < bottom) {
          if (first < 0) first = i;
          last = i;
        }
      });
      if (first < 0) {
        first = 0;
        last = 0;
      }
      paint(list, links, first, last, current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    // Sections also move without scrolling (an accordion opens, a tab switches).
    const content = document.querySelector('.theme-doc-markdown, .changelog-main');
    const resize = content && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (content) resize?.observe(content);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resize?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root]);

  // Docusaurus moves to an anchor with history.push (no hashchange event), so
  // follow the router location: a page load with a hash and TOC clicks alike.
  useEffect(() => {
    const container = root.current;
    const parts = container && hash ? tocParts(container) : null;
    if (!parts) return;
    const target = decodeHash(hash);
    const index = parts.links.findIndex((link) => decodeHash(link.hash) === target);
    if (index < 0) return;
    paint(parts.list, parts.links, index, index, index);
    pinUntil.current = performance.now() + PIN_MS;
  }, [root, hash, key]);
}

type Props = {
  toc: readonly TOCItem[];
  minHeadingLevel?: number;
  maxHeadingLevel?: number;
  /** Fern's changelog has no "Scroll to top". */
  backToTop?: boolean;
};

export default function OnThisPage({toc, minHeadingLevel, maxHeadingLevel, backToTop = true}: Props): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useVisibleRange(ref);
  useEffect(() => {
    if (!backToTop) return undefined;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, [backToTop]);
  return (
    <div ref={ref} className="toc-desktop">
      <div className="toc-desktop__title">On this page</div>
      <div className={clsx('thin-scrollbar', ThemeClassNames.docs.docTocDesktop)}>
        {/* No linkActiveClassName: the current section is set by useVisibleRange. */}
        <TOCItems toc={toc} minHeadingLevel={minHeadingLevel} maxHeadingLevel={maxHeadingLevel} linkClassName="table-of-contents__link" />
      </div>
      {backToTop && (
        <div className="toc-desktop__back-to-top" data-visible={scrolled} aria-hidden={!scrolled}>
          <button type="button" tabIndex={scrolled ? 0 : -1} onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            Scroll to top
            <ArrowUp />
          </button>
        </div>
      )}
    </div>
  );
}
