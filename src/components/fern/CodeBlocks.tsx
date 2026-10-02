import React, {Children, isValidElement, useState, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';

type CodeBlockProps = {title?: string; children?: ReactNode};

/** A titled code block (Fern `<CodeBlock title>` wrapping a fenced block). */
export function CodeBlock({title, children}: CodeBlockProps): React.JSX.Element {
  return (
    <div className="fern-code-block">
      {title && <div className="fern-code-block__title">{title}</div>}
      {children}
    </div>
  );
}

/** Fern `<CodeBlocks>`: tabs over the contained code blocks. */
export function CodeBlocks({children}: {children?: ReactNode}): React.JSX.Element {
  const blocks = Children.toArray(children).filter(isValidElement) as ReactElement<CodeBlockProps>[];
  const [active, setActive] = useState(0);
  return (
    <div className="fern-code-blocks">
      <div className="fern-code-blocks__tabs" role="tablist">
        {blocks.map((block, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={clsx('fern-code-blocks__tab', active === i && 'fern-code-blocks__tab--active')}
            onClick={() => setActive(i)}>
            {block.props.title ?? `Tab ${i + 1}`}
          </button>
        ))}
      </div>
      {blocks.map((block, i) => (
        <div key={i} hidden={active !== i} className="fern-code-blocks__panel">
          {block.props.children}
        </div>
      ))}
    </div>
  );
}
