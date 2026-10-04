// Fern's mobile menu: one panel that slides in from the right under the
// header, listing the header tabs, then the current section's sidebar, then
// "Join Community" and "Start Trading".

import React, {type ReactNode} from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useLockBodyScroll, useNavbarMobileSidebar, useNavbarSecondaryMenu} from '@docusaurus/theme-common/internal';
import NavbarItem, {type Props as NavbarItemProps} from '@theme/NavbarItem';

export default function NavbarMobileSidebar(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const secondaryMenu = useNavbarSecondaryMenu();
  useLockBodyScroll(mobileSidebar.shown);
  const items = useThemeConfig().navbar.items as NavbarItemProps[];
  if (!mobileSidebar.shouldRender) return null;
  const isTab = (item: NavbarItemProps) => String(item.className ?? '').includes('navbar-tab');
  const tabs = items.filter(isTab);
  const links = items.filter((item) => !isTab(item) && item.type !== 'search');
  const close = () => mobileSidebar.toggle();
  return (
    <div className="navbar-sidebar fern-mobile-nav">
      <div className="fern-mobile-nav__scroll menu">
        <ul className="menu__list fern-mobile-nav__tabs">
          {tabs.map((item, i) => (
            <NavbarItem mobile {...item} onClick={close} key={i} />
          ))}
        </ul>
        {secondaryMenu.content && <div className="fern-mobile-nav__sidebar">{secondaryMenu.content}</div>}
        <ul className="menu__list fern-mobile-nav__links">
          {links.map((item, i) => (
            <NavbarItem mobile {...item} onClick={close} key={i} />
          ))}
        </ul>
      </div>
    </div>
  );
}
