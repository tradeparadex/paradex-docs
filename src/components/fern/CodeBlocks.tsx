// Fern `<CodeBlocks>`: one card with a tab per
// contained `<CodeBlock title>` and Fern's flag + copy toolbar, always
// visible, at the right of the tab bar. A titled `<CodeBlock>` on its own
// renders as a one-tab group, as on Fern.

import React, {Children, isValidElement, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import CodeActions from '@site/src/components/code/CodeActions';
import {CodeGroupContext, type CodeGroupPanel} from '@site/src/components/code/context';

type CodeBlockProps = {title?: string; children?: ReactNode};
type Item = {title: ReactNode; content: ReactNode};

function CodeGroup({items}: {items: Item[]}): React.JSX.Element {
  const id = useId();
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const codes = useRef<{code: string; language: string}[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = useMemo<CodeGroupPanel[]>(
    () =>
      items.map((_, i) => ({
        register: (code: string, language: string) => {
          codes.current[i] = {code, language};
        },
      })),
    [items.length],
  );

  const select = (i: number) => {
    const next = (i + items.length) % items.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') select(active + 1);
    else if (event.key === 'ArrowLeft') select(active - 1);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(items.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="fern-code-group">
      <div className="fern-code-group__header">
        <div className="fern-code-group__tabs" role="tablist">
          {items.map((item, i) => (
            <button
              key={i}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-controls={`${id}-panel-${i}`}
              aria-selected={active === i}
              tabIndex={active === i ? 0 : -1}
              className={clsx('fern-code-group__tab', active === i && 'fern-code-group__tab--active')}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}>
              <span className="fern-code-group__label">{item.title}</span>
            </button>
          ))}
        </div>
        <BrowserOnly>
          {() => (
            <CodeActions
              getCode={() => codes.current[activeRef.current]?.code ?? ''}
              getLanguage={() => codes.current[activeRef.current]?.language ?? 'text'}
              className="fern-code__actions--header"
            />
          )}
        </BrowserOnly>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={active !== i}
          className="fern-code-group__panel">
          <CodeGroupContext.Provider value={panels[i]}>{item.content}</CodeGroupContext.Provider>
        </div>
      ))}
    </div>
  );
}

/** A titled code block (Fern `<CodeBlock title>` wrapping a fenced block). */
export function CodeBlock({title, children}: CodeBlockProps): React.JSX.Element {
  if (!title) return <>{children}</>;
  return <CodeGroup items={[{title, content: children}]} />;
}

/** Fern `<CodeBlocks>`: tabs over the contained code blocks. */
export function CodeBlocks({children}: {children?: ReactNode}): React.JSX.Element {
  const blocks = Children.toArray(children).filter(isValidElement) as ReactElement<CodeBlockProps>[];
  return <CodeGroup items={blocks.map((block, i) => ({title: block.props.title ?? `Tab ${i + 1}`, content: block.props.children}))} />;
}
