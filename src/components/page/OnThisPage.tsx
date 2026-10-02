// "On this page" as on Fern: a title, a rail whose highlighted segment spans
// the sections currently on screen, and "Scroll to top" once scrolled. Used
// by docs pages and the changelog.

import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import {ThemeClassNames} from '@docusaurus/theme-common';
import TOC from '@theme/TOC';
import type {TOCItem} from '@docusaurus/mdx-loader';

const ArrowUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 7-7 7 7M12 19V5" />
  </svg>
);

/** Positions the rail highlight over the TOC entries whose sections are visible. */
function useVisibleRange(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const container = root.current;
    if (!container) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const list = container.querySelector<HTMLElement>('.table-of-contents');
      const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.table-of-contents__link'));
      if (!list || !links.length) return;
      const headings = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
      const top = document.querySelector('.navbar')?.getBoundingClientRect().bottom ?? 0;
      const bottom = window.innerHeight;
      const end = document.querySelector('.theme-doc-markdown, .changelog-main')?.getBoundingClientRect().bottom ?? Infinity;
      let first = -1;
      let last = -1;
      headings.forEach((heading, i) => {
        if (!heading) return;
        const start = heading.getBoundingClientRect().top;
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
      const a = links[first].closest('li')!;
      const b = links[last].closest('li')!;
      const listTop = list.getBoundingClientRect().top;
      const from = a.getBoundingClientRect().top - listTop;
      const to = b.getBoundingClientRect().top - listTop + links[last].getBoundingClientRect().height;
      list.style.setProperty('--toc-range-top', `${from}px`);
      list.style.setProperty('--toc-range-height', `${to - from}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [root]);
}

type Props = {toc: readonly TOCItem[]; minHeadingLevel?: number; maxHeadingLevel?: number};

export default function OnThisPage({toc, minHeadingLevel, maxHeadingLevel}: Props): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useVisibleRange(ref);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div ref={ref} className="toc-desktop">
      <div className="toc-desktop__title">On this page</div>
      <TOC
        toc={toc}
        minHeadingLevel={minHeadingLevel}
        maxHeadingLevel={maxHeadingLevel}
        className={ThemeClassNames.docs.docTocDesktop}
      />
      <div className="toc-desktop__back-to-top" data-visible={scrolled} aria-hidden={!scrolled}>
        <button type="button" tabIndex={scrolled ? 0 : -1} onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          Scroll to top
          <ArrowUp />
        </button>
      </div>
    </div>
  );
}
