import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import Icon from './Icon';

export type Intent = 'info' | 'note' | 'tip' | 'warning' | 'error' | 'success' | 'check' | 'launch';

const DEFAULT_ICONS: Record<Intent, ReactNode> = {
  info: <CircleIcon d="M12 8h.01M11 12h1v4h1" />,
  note: <CircleIcon d="M12 8h.01M11 12h1v4h1" />,
  tip: <BulbIcon />,
  warning: <WarnIcon />,
  error: <CircleIcon d="M15 9l-6 6M9 9l6 6" />,
  success: <CircleIcon d="M8.5 12.5l2.5 2.5 5-5.5" />,
  check: <CircleIcon d="M8.5 12.5l2.5 2.5 5-5.5" />,
  launch: <CircleIcon d="M10 8l6 4-6 4z" />,
};

function CircleIcon({d}: {d: string}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d={d} />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
    </svg>
  );
}

type CalloutProps = {
  intent?: Intent;
  title?: ReactNode;
  icon?: string | ReactNode;
  children?: ReactNode;
};

export function Callout({intent = 'info', title, icon, children}: CalloutProps): React.JSX.Element {
  const iconNode = typeof icon === 'string' ? <Icon icon={icon} /> : (icon ?? DEFAULT_ICONS[intent]);
  return (
    <div className={clsx('fern-callout', `fern-callout--${intent}`)} data-intent={intent} role="note">
      <div className="fern-callout__icon">{iconNode}</div>
      <div className="fern-callout__content">
        {title && <div className="fern-callout__title">{title}</div>}
        <div className="fern-callout__body">{children}</div>
      </div>
    </div>
  );
}

type Props = Omit<CalloutProps, 'intent'>;
export const Note = (props: Props) => <Callout intent="note" {...props} />;
export const Info = (props: Props) => <Callout intent="info" {...props} />;
export const Tip = (props: Props) => <Callout intent="tip" {...props} />;
export const Warning = (props: Props) => <Callout intent="warning" {...props} />;
export const ErrorCallout = (props: Props) => <Callout intent="error" {...props} />;
export const Success = (props: Props) => <Callout intent="success" {...props} />;
export const Check = (props: Props) => <Callout intent="check" {...props} />;
export const Launch = (props: Props) => <Callout intent="launch" {...props} />;
