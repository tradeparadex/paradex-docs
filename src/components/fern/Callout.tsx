import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import Icon from './Icon';

export type Intent = 'info' | 'note' | 'tip' | 'warning' | 'error' | 'success' | 'check' | 'launch';

// Fern's default callout icons (Lucide): info, bell, circle-check-big,
// triangle-alert, pin, rocket, star and check.
const ICON_PATHS: Record<Intent, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  success: (
    <>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  error: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  note: (
    <>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </>
  ),
  launch: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  tip: (
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  ),
  check: <path d="M20 6 9 17l-5-5" />,
};

function DefaultIcon({intent}: {intent: Intent}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="callout-icon">
      {ICON_PATHS[intent] ?? ICON_PATHS.info}
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
  const iconNode =
    typeof icon === 'string' ? <Icon icon={icon} className="callout-icon" /> : (icon ?? <DefaultIcon intent={intent} />);
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
