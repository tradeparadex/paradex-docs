import React, {type ReactNode} from 'react';
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
      /^(https?:|\/|\.)/.test(icon) ? <img src={icon} alt="" /> : <Icon icon={icon} />
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

export function CardGroup({cols = 2, children}: {cols?: number; children?: ReactNode}): React.JSX.Element {
  return (
    <div className="fern-card-group" style={{['--fern-cols' as string]: cols}}>
      {children}
    </div>
  );
}
