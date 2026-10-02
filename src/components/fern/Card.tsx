import React, {Children, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Icon from './Icon';

type CardProps = {
  title?: ReactNode;
  icon?: string | ReactNode;
  href?: string;
  className?: string;
  children?: ReactNode;
};

export function Card({title, icon, href, className, children}: CardProps): React.JSX.Element {
  const iconNode =
    typeof icon === 'string' ? (
      /^(https?:|\/|\.)/.test(icon) ? <img src={icon} alt="" /> : <Icon icon={icon} className="fern-card__svg" />
    ) : (
      icon
    );
  const content = (
    <>
      {iconNode && <div className="fern-card__icon card-icon">{iconNode}</div>}
      {title && <div className="fern-card__title">{title}</div>}
      {children && <div className="fern-card__body text-body">{children}</div>}
    </>
  );
  const classes = clsx('fern-card', href && 'fern-card--link', className);
  return href ? (
    <Link className={classes} to={href}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}

/** Like Fern: `cols` defaults to the number of cards, at most 2; one column on phones. */
export function CardGroup({cols, children}: {cols?: number; children?: ReactNode}): React.JSX.Element {
  const count = cols ?? Math.min(Children.toArray(children).length, 2);
  const columns = Math.max(1, Math.min(count, 6));
  return (
    <div className={clsx('fern-card-group', `fern-card-group--cols-${columns}`)} style={{['--fern-cols' as string]: columns}}>
      {children}
    </div>
  );
}
