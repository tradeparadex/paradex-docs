import React, {Children, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import {useAnchorId} from './anchors';

type TabProps = {title: string; children?: ReactNode};

export function Tab({children}: TabProps): React.JSX.Element {
  return <>{children}</>;
}

function TabButton({title, index, active, panelId, onSelect}: {title: string; index: number; active: boolean; panelId: string; onSelect: (i: number) => void}) {
  const anchor = useAnchorId(title);
  return (
    <button
      type="button"
      role="tab"
      id={anchor}
      aria-selected={active}
      aria-controls={panelId}
      className={clsx('fern-tabs__tab', active && 'fern-tabs__tab--active')}
      onClick={() => onSelect(index)}>
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
  // panel (a heading in the search index) selects that tab. Docusaurus moves
  // to an anchor with history.push (no hashchange event), so follow the router
  // location: a page load with a hash, links and search results alike.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    const [list, ...panels] = root.current ? Array.from(root.current.children) : [];
    if (!target || !list) return;
    const index = list.contains(target)
      ? Array.from(list.children).indexOf(target)
      : panels.findIndex((panel) => (panel as HTMLElement).hidden && panel.contains(target));
    if (index < 0) return;
    setActive(index);
    // A tab's own scroll-margin is clipped by the row's scroll box, so the row
    // (also when it belongs to nested tabs) is what lands below the header.
    setReveal({target: target.closest('.fern-tabs__list') ?? target});
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
      <div className="fern-tabs__list" role="tablist">
        {tabs.map((tab, i) => (
          <TabButton key={i} title={tab.props.title} index={i} active={active === i} panelId={`${id}-panel-${i}`} onSelect={setActive} />
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} hidden={active !== i} className="fern-tabs__panel">
          {tab.props.children}
        </div>
      ))}
    </div>
  );
}
