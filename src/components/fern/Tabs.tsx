import React, {Children, isValidElement, useId, useState, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import {useAnchorId, useHashTarget} from './anchors';

type TabProps = {title: string; children?: ReactNode};

export function Tab({children}: TabProps): React.JSX.Element {
  return <>{children}</>;
}

function TabButton({title, index, active, panelId, onSelect}: {title: string; index: number; active: boolean; panelId: string; onSelect: (i: number) => void}) {
  const anchor = useAnchorId(title);
  useHashTarget(anchor, () => onSelect(index));
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
  const id = useId();
  return (
    <div className="fern-tabs">
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
