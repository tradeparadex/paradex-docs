// Docs sidebar, followed by Fern's hidden "Site navigation" list: a plain link
// to every page of the tab. The sidebar renders a collapsed group's pages only
// once it is expanded, so without the list most endpoint and instrument pages
// would not be linked from other pages' HTML (crawlers, agents, no-JS readers).

import React, {type ReactNode} from 'react';
import DocSidebar from '@theme-original/DocSidebar';
import type {Props} from '@theme/DocSidebar';
import type {PropSidebarItem} from '@docusaurus/plugin-content-docs';
import isInternalUrl from '@docusaurus/isInternalUrl';

type PageLink = {href: string; label: string};

function pageLinks(items: readonly PropSidebarItem[], links: PageLink[] = []): PageLink[] {
  for (const item of items) {
    if (item.type === 'category') {
      if (item.href) links.push({href: item.href, label: item.label});
      pageLinks(item.items, links);
    } else if (item.type === 'link' && isInternalUrl(item.href)) {
      links.push({href: item.href, label: item.label});
    }
  }
  return links;
}

export default function DocSidebarWrapper(props: Props): ReactNode {
  return (
    <>
      <DocSidebar {...props} />
      {/* As on Fern: hidden from view and from assistive technology. Plain
          anchors, as <Link> would prefetch every page. */}
      <nav aria-label="Site navigation" aria-hidden="true" inert className="visually-hidden">
        <ul>
          {pageLinks(props.sidebar).map(({href, label}, i) => (
            <li key={i}>
              <a href={href} tabIndex={-1}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
