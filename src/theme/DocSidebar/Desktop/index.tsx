// Docusaurus renders the desktop sidebar from 997px; Fern's starts at 1024px
// and narrower windows reach the sidebar through the menu. In between, fill
// the menu's drawer instead, as below 997px (CSS hides the sidebar column).

import React, {type ReactNode} from 'react';
import DocSidebarDesktop from '@theme-original/DocSidebar/Desktop';
import DocSidebarMobile from '@theme/DocSidebar/Mobile';
import type {Props} from '@theme/DocSidebar/Desktop';
import {useFernWindowSize} from '@site/src/components/windowSize';

export default function DocSidebarDesktopWrapper(props: Props): ReactNode {
  // 'ssr' until hydrated, so the server HTML and the first render agree.
  return useFernWindowSize() === 'mobile' ? <DocSidebarMobile {...props} /> : <DocSidebarDesktop {...props} />;
}
