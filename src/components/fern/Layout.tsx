import React, {createContext, useContext, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {useAnchorId, useHashTarget} from './anchors';

export function Accordion({title, defaultOpen, children}: {title: ReactNode; defaultOpen?: boolean; children?: ReactNode}): React.JSX.Element {
  const id = useAnchorId(title);
  const [open, setOpen] = useState(Boolean(defaultOpen));
  useHashTarget(id, () => setOpen(true));
  // Like Fern, opening an accordion puts its id in the URL (so the address bar
  // holds a deep link to it) and closing it takes the id out again.
  const onSummaryClick = (event: React.MouseEvent<HTMLElement>) => {
    const details = event.currentTarget.parentElement as HTMLDetailsElement | null;
    if (!id || !details) return;
    const {pathname, search, hash} = window.location;
    if (!details.open) {
      window.history.replaceState(window.history.state, '', `${pathname}${search}#${id}`);
    } else if (decodeURIComponent(hash.slice(1)) === id) {
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
  };
  return (
    <details
      className="fern-accordion"
      open={open}
      id={id}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary className="fern-accordion__summary" onClick={onSummaryClick}>
        <svg className="fern-accordion__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="fern-accordion__title">{title}</span>
      </summary>
      <div className="fern-accordion__body">{children}</div>
    </details>
  );
}

export function AccordionGroup({children}: {children?: ReactNode}): React.JSX.Element {
  return <div className="fern-accordion-group">{children}</div>;
}

const InSteps = createContext(false);

/** True for headings directly inside <Steps>, which carry the step number. */
export function useInSteps(): boolean {
  return useContext(InSteps);
}

/** The step number badge; as on Fern it links to the step. */
export function StepAnchor({id}: {id?: string}): React.JSX.Element {
  return <a className="fern-step__anchor" href={id ? `#${id}` : undefined} aria-label="Link to this step" />;
}

/** Steps accept <Step title> children or plain `###` headings, as in Fern. */
export function Steps({children}: {children?: ReactNode}): React.JSX.Element {
  return (
    <div className="fern-steps">
      <InSteps.Provider value>{children}</InSteps.Provider>
    </div>
  );
}

export function Step({title, children}: {title?: ReactNode; children?: ReactNode}): React.JSX.Element {
  const id = useAnchorId(title);
  return (
    <div className="fern-step">
      {title && (
        <h3 className="fern-step__title" id={id}>
          <StepAnchor id={id} />
          {title}
        </h3>
      )}
      <div className="fern-step__body">
        <InSteps.Provider value={false}>{children}</InSteps.Provider>
      </div>
    </div>
  );
}

export function Frame({caption, children, className}: {caption?: ReactNode; children?: ReactNode; className?: string}): React.JSX.Element {
  return (
    <figure className={clsx('fern-frame', className)}>
      <div className="fern-frame__content">{children}</div>
      {caption && <figcaption className="fern-frame__caption">{caption}</figcaption>}
    </figure>
  );
}

type BadgeProps = {intent?: string; outlined?: boolean; minimal?: boolean; rounded?: boolean; children?: ReactNode};
/** Fern's MDX badge; `outlined` + `minimal` is its "outlined-subtle" variant. */
export function Badge({intent = 'note', outlined, minimal, rounded, children}: BadgeProps): React.JSX.Element {
  const variant = outlined && minimal ? 'outlined-subtle' : outlined ? 'outlined' : minimal ? 'subtle' : 'solid';
  return (
    <span className={clsx('fern-docs-badge', `fern-docs-badge--${intent}`, variant, rounded && 'rounded')} data-intent={intent}>
      {children}
    </span>
  );
}

type ButtonProps = {
  href?: string;
  intent?: string;
  large?: boolean;
  small?: boolean;
  rounded?: boolean;
  outlined?: boolean;
  minimal?: boolean;
  children?: ReactNode;
};
export function Button({href, intent = 'none', large, small, rounded, outlined, minimal, children}: ButtonProps): React.JSX.Element {
  const className = clsx(
    'fern-button',
    outlined ? 'outlined' : minimal ? 'minimal' : 'filled',
    intent,
    large ? 'large' : small ? 'small' : 'normal',
    rounded && 'rounded',
  );
  return href ? (
    <Link className={className} to={href}>
      <span className="fern-button-text">{children}</span>
    </Link>
  ) : (
    <button type="button" className={className}>
      <span className="fern-button-text">{children}</span>
    </button>
  );
}

const TAG_CLASS: Record<string, string> = {UI: 'ui', API: 'api'};
export function ChangelogTags({tags = []}: {tags?: string[]}): React.JSX.Element {
  return (
    <div className="fern-changelog-tags">
      {tags.map((tag) => (
        <span key={tag} className={clsx('fern-changelog-tag', `fern-changelog-tag--${TAG_CLASS[tag] ?? 'other'}`)}>
          {tag}
        </span>
      ))}
    </div>
  );
}
