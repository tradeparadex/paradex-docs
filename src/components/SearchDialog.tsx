// Search as on Fern: a "Search /" button in the header that opens a dialog
// (also on "/" or Ctrl/⌘+K). The dialog hosts the local search
// (@easyops-cn/docusaurus-search-local) with its results listed in place.

import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useLocation} from '@docusaurus/router';
import SearchBar from '@theme/SearchBar';

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
};

export default function SearchDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const {pathname} = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        return;
      }
      const shortcut = (event.key === '/' && !isTyping(event.target)) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');
      if (shortcut) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.classList.add('search-dialog-open');
    const frame = window.requestAnimationFrame(() => panel.current?.querySelector('input')?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove('search-dialog-open');
    };
  }, [open]);

  return (
    <>
      <button ref={trigger} type="button" className="search-trigger" aria-label="Search" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <SearchIcon />
        <span className="search-trigger__label">Search</span>
        <kbd>/</kbd>
      </button>
      {open &&
        createPortal(
          <div
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}>
            <div className="search-dialog__panel" ref={panel}>
              <SearchBar />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
