// A diagram pre-rendered by plugins/mermaid.mjs. Clicking it opens it in a
// dialog, as on Fern.

import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

export default function MermaidDiagram({svg}: {svg: string}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('mermaid-zoom-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('mermaid-zoom-open');
    };
  }, [open]);
  return (
    <>
      <div
        className="mermaid-container mermaid-container-static"
        role="button"
        tabIndex={0}
        aria-label="Enlarge diagram"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        dangerouslySetInnerHTML={{__html: svg}}
      />
      {open &&
        createPortal(
          <div className="mermaid-zoom" role="dialog" aria-modal="true" aria-label="Diagram" onClick={() => setOpen(false)}>
            <div className="mermaid-zoom__panel" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="mermaid-zoom__close" aria-label="Close" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="mermaid-zoom__body" dangerouslySetInnerHTML={{__html: svg}} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
