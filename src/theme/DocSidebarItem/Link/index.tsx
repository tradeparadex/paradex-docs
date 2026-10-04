// Sidebar link with optional Font Awesome icon (`icon:` in navigation.yml).

import React, {type MouseEvent, type ReactNode} from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {isActiveSidebarItem} from '@docusaurus/plugin-content-docs/client';
import Link from '@docusaurus/Link';
import isInternalUrl from '@docusaurus/isInternalUrl';
import IconExternalLink from '@theme/Icon/ExternalLink';
import type {Props} from '@theme/DocSidebarItem/Link';
import Icon from '@site/src/components/fern/Icon';

// As on Fern, hovering a one-word label cut off by its ellipsis scrolls the
// rest into view, at about 90px a second (custom.css runs the animation).
function startMarquee({currentTarget: label}: MouseEvent<HTMLElement>) {
  const overflow = Math.ceil(label.scrollWidth - label.clientWidth);
  if (overflow <= 0) return;
  label.style.setProperty('--marquee-translate', `${-overflow}px`);
  label.style.setProperty('--marquee-duration', `${Math.max(0.8, overflow / 90)}s`);
  label.classList.add('sidebar-item-label--marquee');
}

function stopMarquee({currentTarget: label}: MouseEvent<HTMLElement>) {
  label.classList.remove('sidebar-item-label--marquee');
}

export default function DocSidebarItemLink({item, onItemClick, activePath, level, index, ...props}: Props): ReactNode {
  const {href, label, className, autoAddBaseUrl, customProps} = item;
  const isActive = isActiveSidebarItem(item, activePath);
  const isInternalLink = isInternalUrl(href);
  const icon = (customProps as {icon?: string} | undefined)?.icon;
  return (
    <li
      className={clsx(
        ThemeClassNames.docs.docSidebarItemLink,
        ThemeClassNames.docs.docSidebarItemLinkLevel(level),
        'menu__list-item',
        className,
      )}
      key={label}>
      <Link
        className={clsx('menu__link', {'menu__link--active': isActive})}
        autoAddBaseUrl={autoAddBaseUrl}
        aria-current={isActive ? 'page' : undefined}
        to={href}
        {...(isInternalLink && {onClick: onItemClick ? () => onItemClick(item) : undefined})}
        {...props}>
        {icon && <Icon icon={icon} className="sidebar-item-icon" />}
        {/\s/.test(label) ? (
          <span className="sidebar-item-label">{label}</span>
        ) : (
          <span className="sidebar-item-label sidebar-item-label--nowrap" onMouseEnter={startMarquee} onMouseLeave={stopMarquee}>
            <span>{label}</span>
          </span>
        )}
        {!isInternalLink && <IconExternalLink />}
      </Link>
    </li>
  );
}
