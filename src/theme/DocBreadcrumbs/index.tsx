// Breadcrumbs as on Fern: the page's parent sections only (no home icon, no
// current page), in the accent color.

import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useSidebarBreadcrumbs} from '@docusaurus/plugin-content-docs/client';

export default function DocBreadcrumbs(): ReactNode {
  const breadcrumbs = useSidebarBreadcrumbs();
  const ancestors = (breadcrumbs ?? []).slice(0, -1);
  if (!ancestors.length) return null;
  return (
    <nav className="theme-doc-breadcrumbs" aria-label="Breadcrumbs">
      <ul className="breadcrumbs">
        {ancestors.map((item, index) => {
          const href = item.type === 'category' && item.linkUnlisted ? undefined : item.href;
          return (
            <li key={index} className="breadcrumbs__item">
              {href ? (
                <Link className="breadcrumbs__link" href={href}>
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumbs__link">{item.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
