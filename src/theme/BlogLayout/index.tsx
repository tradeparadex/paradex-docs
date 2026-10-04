// Release notes ("Changelog") layout, matching the Fern changelog: a sidebar
// with a single "Changelog" entry, a narrow content column and an optional
// "On this page" column.

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {usePluginData} from '@docusaurus/useGlobalData';
import type {Props} from '@theme/BlogLayout';

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="sidebar-item-icon">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l4 2" />
  </svg>
);

export default function BlogLayout(props: Props): ReactNode {
  const {toc, children, ...layoutProps} = props;
  const {changelogUrl} = usePluginData('paradex-site') as {changelogUrl: string};
  const {pathname} = useLocation();
  const onIndex = pathname === changelogUrl || pathname.startsWith(`${changelogUrl}/page/`);
  return (
    <Layout {...layoutProps}>
      <div className="changelog-layout">
        <aside className="changelog-sidebar theme-doc-sidebar-container">
          <nav className="theme-doc-sidebar-menu menu" aria-label="Changelog">
            <ul className="menu__list">
              <li className="menu__list-item">
                <Link className={clsx('menu__link', onIndex && 'menu__link--active')} to={changelogUrl} aria-current={onIndex ? 'page' : undefined}>
                  <HistoryIcon />
                  <span className="sidebar-item-label">Changelog</span>
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
        <main className="changelog-main">{children}</main>
        {/* Fern shows "On this page" on the index only, not on an entry's page. */}
        <div className="changelog-toc">{onIndex && toc}</div>
      </div>
    </Layout>
  );
}
