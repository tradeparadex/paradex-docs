import React, {Children, createContext, isValidElement, useContext, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import {useMDXComponents} from '@mdx-js/react';
import Link from '@docusaurus/Link';
import {CheckIcon, LinkIcon} from '@site/src/components/api/icons';
import {isPlainClick, useAnchorId, useCopyLink, useHashTarget} from './anchors';

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

const InStepTitle = createContext(false);
const StepNumber = createContext<number | undefined>(undefined);

/** True inside a `###` step title, which links through its number badge. */
export function useInStepTitle(): boolean {
  return useContext(InStepTitle);
}

/**
 * The step number badge, beside the title as on Fern: a link to the step
 * (out of the tab order) that copies the link on click, showing a link icon
 * while the title is hovered and a tick once copied.
 */
function StepAnchor({id, number}: {id?: string; number?: number}): React.JSX.Element {
  const [copied, copy] = useCopyLink(id);
  return (
    <a
      className={clsx('fern-anchor', copied && 'fern-anchor--copied')}
      href={id ? `#${id}` : undefined}
      tabIndex={-1}
      onClick={(event) => {
        if (!id || !isPlainClick(event)) return;
        event.preventDefault();
        copy();
      }}>
      <span className="fern-anchor-icon">
        {copied ? (
          <CheckIcon />
        ) : (
          <>
            <span className="fern-step__number">{number}</span>
            <LinkIcon className="fern-step__link-icon" />
          </>
        )}
      </span>
    </a>
  );
}

type HeadingStep = {heading: React.ReactElement<{id?: string}>; body: ReactNode[]};
const isHeadingStep = (item: unknown): item is HeadingStep =>
  typeof item === 'object' && item !== null && !isValidElement(item) && 'heading' in item;

/**
 * Steps take <Step title> children or plain `###` headings, as in Fern: a
 * heading starts a step that runs to the next one. The steps are numbered
 * here, so the number is text (read out, copied, found in the page).
 */
export function Steps({children}: {children?: ReactNode}): React.JSX.Element {
  const {h3} = useMDXComponents();
  const items: (ReactNode | HeadingStep)[] = [];
  for (const child of Children.toArray(children)) {
    const last = items[items.length - 1];
    if (isValidElement<{id?: string}>(child) && child.type === h3) items.push({heading: child, body: []});
    else if (isHeadingStep(last) && !(isValidElement(child) && child.type === Step)) last.body.push(child);
    else items.push(child);
  }
  let number = 0;
  return (
    <div className="fern-steps">
      {items.map((item) => {
        if (isHeadingStep(item)) {
          number += 1;
          return (
            <div key={item.heading.key} className="fern-step">
              <StepAnchor id={item.heading.props.id} number={number} />
              <InStepTitle.Provider value>{item.heading}</InStepTitle.Provider>
              {item.body}
            </div>
          );
        }
        if (isValidElement(item) && item.type === Step) {
          number += 1;
          return (
            <StepNumber.Provider key={item.key} value={number}>
              {item}
            </StepNumber.Provider>
          );
        }
        return item;
      })}
    </div>
  );
}

export function Step({title, children}: {title?: ReactNode; children?: ReactNode}): React.JSX.Element {
  const id = useAnchorId(title);
  const number = useContext(StepNumber);
  return (
    <div className="fern-step">
      {title && <StepAnchor id={id} number={number} />}
      {title && (
        <h3 className="fern-step__title" id={id}>
          {title}
        </h3>
      )}
      <div className="fern-step__body">{children}</div>
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
