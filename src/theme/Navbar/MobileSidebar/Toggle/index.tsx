// The mobile menu button: a small menu icon, or a teal square with an X
// while the menu is open (as on Fern).

import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';

export default function MobileSidebarToggle(): ReactNode {
  const {toggle, shown} = useNavbarMobileSidebar();
  return (
    <button
      onClick={toggle}
      aria-label={shown ? 'Close menu' : 'Open menu'}
      aria-expanded={shown}
      className={clsx('navbar__toggle clean-btn', shown && 'navbar__toggle--open')}
      type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {shown ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
      </svg>
    </button>
  );
}
