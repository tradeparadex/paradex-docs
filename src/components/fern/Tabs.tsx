import React, {Children, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import {useAnchorId} from './anchors';

type TabProps = {title: string; children?: ReactNode};

export function Tab({children}: TabProps): React.JSX.Element {
  return <>{children}</>;
}

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
  const {hash, key} = useLocation();

  // As on Fern, a link to a tab (#closing-hours) or to anything in a hidden
  // panel (a heading) selects that tab; so does a search hit on a tab's text,
  // which the index keys by the tab's anchor (plugins/search-local.mjs).
  // Docusaurus moves to an anchor with history.push (no hashchange event), so
  // follow the router location: a page load with a hash, links and search
  // results alike.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
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

  return (
    <div className="fern-tabs" ref={root}>
      <div className="fern-tabs__bar">
        {tabs.map((tab, i) => (
          <TabAnchor key={i} title={tab.props.title} />
        ))}
        <div className="fern-tabs__list" role="tablist">
          {tabs.map((tab, i) => (
            <TabButton key={i} title={tab.props.title} active={active === i} panelId={`${id}-panel-${i}`} onSelect={() => setActive(i)} />
          ))}
        </div>
      </div>
      {tabs.map((tab, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} hidden={active !== i} className="fern-tabs__panel">
          {tab.props.children}
        </div>
      ))}
    </div>
  );
}
