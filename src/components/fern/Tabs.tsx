import React, {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import {decodeHash, useAnchorId} from './anchors';

type TabProps = {title: string; children?: ReactNode};

export function Tab({children}: TabProps): React.JSX.Element {
  return <>{children}</>;
}

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/**
 * A tab's link target (#closing-hours). It sits outside the scrolling tab row
 * and cannot take focus, so the browser's own jump to it (on a page load, or
 * a link to the hash already in the address bar) lands the row below the
 * header and leaves focus on the page, as on Fern.
 */
function TabAnchor({title}: {title: string}) {
  return <span id={useAnchorId(title)} className="fern-tabs__anchor" />;
}

function TabButton({title, active, panelId, onSelect}: {title: string; active: boolean; panelId: string; onSelect: () => void}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      className={clsx('fern-tabs__tab', active && 'fern-tabs__tab--active')}
      onClick={onSelect}>
      {title}
    </button>
  );
}

/** Whether the tab row overflows, and which of its ends hold hidden tabs. */
function useOverflow(list: RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState({overflow: false, left: false, right: false});
  useEffect(() => {
    const row = list.current;
    if (!row || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      const next = {overflow: max > 1, left: max > 1 && row.scrollLeft > 1, right: max > 1 && row.scrollLeft < max - 1};
      setState((prev) => (prev.overflow === next.overflow && prev.left === next.left && prev.right === next.right ? prev : next));
    };
    // The tabs too: their width changes when the web font loads.
    const observer = new ResizeObserver(update);
    [row, ...Array.from(row.children)].forEach((el) => observer.observe(el));
    row.addEventListener('scroll', update, {passive: true});
    return () => {
      observer.disconnect();
      row.removeEventListener('scroll', update);
    };
  }, [list]);
  return state;
}

// Fern's menu items are 28px, inside 4px padding and a 1px border, up to 300px.
const menuHeight = (items: number) => Math.min(300, items * 28 + 10);

/**
 * Fern's "Show all tabs" menu at the end of an overflowing tab row: every tab,
 * a check on the selected one. Behaves like Fern's (Radix) menu: it opens below
 * the button or, without room there, above; arrow keys, Home and End move
 * through it, the pointer highlights, Escape and picking a tab close it and
 * return focus to the button.
 */
function TabMenu({titles, active, onSelect}: {titles: string[]; active: number; onSelect: (index: number) => void}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Opened with the keyboard: start on the first item, as Radix does.
  const fromKeyboard = useRef(false);
  const buttonId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const first = menu.current?.querySelector<HTMLElement>('[role=menuitemradio]');
    (fromKeyboard.current ? first : menu.current)?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const show = (keyboard: boolean) => {
    const rect = button.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom - 4;
      setAbove(below < menuHeight(titles.length) && rect.top - 4 > below);
    }
    fromKeyboard.current = keyboard;
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role=menuitemradio]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: index < 0 ? 0 : Math.min(last, index + 1),
      ArrowUp: index < 0 ? last : Math.max(0, index - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      items[moves[event.key]]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="fern-tabs__more" ref={wrap}>
      <button
        ref={button}
        id={buttonId}
        type="button"
        className="fern-tabs__more-button"
        aria-label="Show all tabs"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => (open ? setOpen(false) : show(event.detail === 0))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            show(true);
          }
        }}>
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          tabIndex={-1}
          className={clsx('fern-tabs__menu', above && 'fern-tabs__menu--above')}
          onKeyDown={onMenuKey}>
          {titles.map((title, i) => (
            <button
              key={i}
              type="button"
              role="menuitemradio"
              aria-checked={i === active}
              tabIndex={-1}
              className="fern-tabs__menu-item"
              onPointerMove={(event) => event.currentTarget.focus({preventScroll: true})}
              onPointerLeave={() => menu.current?.focus({preventScroll: true})}
              onClick={() => {
                onSelect(i);
                close();
              }}>
              <span className="fern-tabs__menu-check">{i === active && <CheckIcon />}</span>
              <span className="fern-tabs__menu-label">{title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fern `<Tabs><Tab title="...">` — every panel is rendered (and indexed), only one shown. */
export function Tabs({children}: {children?: ReactNode}): React.JSX.Element {
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> => isValidElement(child) && typeof (child.props as TabProps).title === 'string',
  );
  const [active, setActive] = useState(0);
  // What to scroll to once the selected panel shows; a new object per link, so
  // following the same link again scrolls again.
  const [reveal, setReveal] = useState<{target: Element}>();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const {overflow, left, right} = useOverflow(list);
  const {hash, key} = useLocation();

  // As on Fern, a link to a tab (#closing-hours) or to anything in a hidden
  // panel (a heading) selects that tab; so does a search hit on a tab's text,
  // which the index keys by the tab's anchor (plugins/search-local.mjs).
  // Docusaurus moves to an anchor with history.push (no hashchange event), so
  // follow the router location: a page load with a hash, links and search
  // results alike.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeHash(hash)) : null;
    if (!target || !root.current) return;
    const anchors = Array.from(root.current.querySelectorAll(':scope > .fern-tabs__bar > .fern-tabs__anchor'));
    const panels = Array.from(root.current.querySelectorAll<HTMLElement>(':scope > [role=tabpanel]'));
    let index = anchors.indexOf(target);
    if (index < 0) index = panels.findIndex((panel) => panel.hidden && panel.contains(target));
    if (index < 0) return;
    setActive(index);
    setReveal({target});
  }, [hash, key]);

  // Scroll once the panel shows, and again as its images load (the roadmap's
  // banner images push the target ~500px down), unless the reader has
  // scrolled since.
  useEffect(() => {
    if (!reveal) return undefined;
    const images = Array.from(root.current?.querySelectorAll('img') ?? []).filter((img) => !img.complete);
    let y: number | undefined;
    const align = () => {
      if (y !== undefined && window.scrollY !== y) return;
      reveal.target.scrollIntoView({block: 'start'});
      y = window.scrollY;
    };
    align();
    images.forEach((img) => img.addEventListener('load', align));
    return () => images.forEach((img) => img.removeEventListener('load', align));
  }, [reveal]);

  // Bring the selected tab into an overflowing row, to its nearest edge as
  // Fern does. Only the row scrolls, never the page.
  useEffect(() => {
    const row = list.current;
    const tab = row?.children[active];
    if (!row || !tab) return;
    const outer = row.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    if (inner.left < outer.left) row.scrollLeft -= outer.left - inner.left;
    else if (inner.right > outer.right) row.scrollLeft += inner.right - outer.right;
  }, [active]);

  return (
    <div className="fern-tabs" ref={root}>
      <div className="fern-tabs__bar">
        {tabs.map((tab, i) => (
          <TabAnchor key={i} title={tab.props.title} />
        ))}
        <div
          ref={list}
          className={clsx('fern-tabs__list', left && 'fern-tabs__list--left-mask', right && 'fern-tabs__list--right-mask')}
          role="tablist">
          {tabs.map((tab, i) => (
            <TabButton key={i} title={tab.props.title} active={active === i} panelId={`${id}-panel-${i}`} onSelect={() => setActive(i)} />
          ))}
        </div>
        {overflow && <TabMenu titles={tabs.map((tab) => tab.props.title)} active={active} onSelect={setActive} />}
      </div>
      {tabs.map((tab, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} hidden={active !== i} className="fern-tabs__panel">
          {tab.props.children}
        </div>
      ))}
    </div>
  );
}
