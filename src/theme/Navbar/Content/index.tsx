// Two-row header, as on the Fern site:
//   row 1: logo | search | "Join Community" + "Start Trading"
//   row 2: one link per tab (navbar items with className "navbar-tab")
// On mobile the tabs move into the drawer menu.

import React, {type ReactNode} from 'react';
import {useThemeConfig, ErrorCauseBoundary} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarItem, {type Props as NavbarItemConfig} from '@theme/NavbarItem';
import SearchBar from '@theme/SearchBar';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';
import NavbarLogo from '@theme/Navbar/Logo';
import NavbarSearch from '@theme/Navbar/Search';

function NavbarItems({items}: {items: NavbarItemConfig[]}): ReactNode {
  return (
    <>
      {items.map((item, i) => (
        <ErrorCauseBoundary
          key={i}
          onError={(error) =>
            new Error(`A theme navbar item failed to render:\n${JSON.stringify(item, null, 2)}`, {cause: error})
          }>
          <NavbarItem {...item} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}

const isTab = (item: NavbarItemConfig) => String((item as {className?: string}).className ?? '').includes('navbar-tab');

export default function NavbarContent(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useThemeConfig().navbar.items as NavbarItemConfig[];
  const tabs = items.filter(isTab);
  const rightItems = items.filter((item) => !isTab(item) && item.type !== 'search');

  return (
    <>
      <div className="navbar__inner">
        <div className="navbar__items">
          <NavbarLogo />
        </div>
        <div className="navbar-search-center">
          <NavbarSearch>
            <SearchBar />
          </NavbarSearch>
        </div>
        <div className="navbar__items navbar__items--right">
          <NavbarItems items={rightItems} />
          {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
        </div>
      </div>
      <div className="navbar-tabs" role="navigation" aria-label="Sections">
        <NavbarItems items={tabs} />
      </div>
    </>
  );
}
