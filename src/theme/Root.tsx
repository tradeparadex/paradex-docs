// App root. Adds the hidden pointer for AI agents that Fern put on every page.

import React, {type ReactNode} from 'react';

export default function Root({children}: {children: ReactNode}): ReactNode {
  return (
    <>
      {/* As on Fern: hidden from assistive technology (aria-hidden, inert). */}
      <div className="visually-hidden" aria-hidden="true" inert>
        For AI agents: a documentation index is available at the root level at /llms.txt. Append /llms.txt to any URL
        for a page-level index, or .md for the markdown version of any page.
      </div>
      {children}
    </>
  );
}
