// Fern's code block toolbar: borderless "Report incorrect code" (flag) and
// "Copy to clipboard" icon buttons. The flag opens Fern's feedback popover;
// opening it and sending a report go out as Fern's code_block_feedback_opened
// and code_block_feedback_submitted events, through the page feedback's
// track() (PostHog and the GTM data layer), and a report offers a prefilled
// GitHub issue.

import React, {useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type SyntheticEvent} from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {track} from '@site/src/components/page/Feedback';

/** The tab of a tabbed group (Fern `<CodeBlocks>`) whose code is shown. */
type CodeTab = {title: string; index: number; language?: string};

type CodeSource = {getCode: () => string; getLanguage?: () => string; getTab?: () => CodeTab};

// Fern's Radix tooltip is centred above the button and kept 6px inside the
// viewport. The CSS (code.css) shifts ours by what the room between the
// button's centre and each edge of the viewport allows.
function measureTooltipRoom(event: SyntheticEvent<HTMLButtonElement>): void {
  const button = event.currentTarget;
  const {left, width} = button.getBoundingClientRect();
  const centre = left + width / 2;
  button.style.setProperty('--fern-tooltip-left', `${centre}px`);
  button.style.setProperty('--fern-tooltip-right', `${document.documentElement.clientWidth - centre}px`);
}

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const {default: copy} = await import('copy-text-to-clipboard');
  copy(text);
}

export function CopyButton({getCode}: CodeSource): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onClick = useCallback(() => {
    void copyText(getCode()).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    });
  }, [getCode]);
  return (
    <button
      type="button"
      className={clsx('fern-code__action', 'fern-code__copy', copied && 'fern-code__action--done')}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      data-tooltip={copied ? 'Copied!' : 'Copy to clipboard'}
      onPointerEnter={measureTooltipRoom}
      onFocus={measureTooltipRoom}
      onClick={onClick}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

// Fern's payload for both events: the block's language (Fern calls a fence
// without one 'plaintext', Docusaurus 'text') and code, and in a tabbed group
// the tab shown.
function feedbackProperties({getCode, getLanguage, getTab}: CodeSource): Record<string, unknown> {
  const language = getLanguage?.() ?? 'text';
  const tab = getTab?.();
  return {
    language: language === 'text' ? 'plaintext' : language,
    code: getCode(),
    ...(tab && {activeTabTitle: tab.title, activeTabIndex: tab.index, ...(tab.language && {activeTabLanguage: tab.language})}),
  };
}

function useIssueUrl(): (message: string, code: string, language: string) => string {
  const {siteConfig} = useDocusaurusContext();
  return (message, code, language) => {
    const page = window.location.origin + window.location.pathname;
    const snippet = code.length > 1500 ? `${code.slice(0, 1500)}\n…` : code;
    const body = [`Page: ${page}`, '', message.trim(), '', '```' + (language === 'text' ? '' : language), snippet, '```'].join('\n');
    const title = `Incorrect code example on ${window.location.pathname}`;
    return `https://github.com/${siteConfig.organizationName}/${siteConfig.projectName}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  };
}

export function FlagButton(source: CodeSource): React.JSX.Element {
  const {getCode, getLanguage} = source;
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'top' | 'bottom'>('top');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const issueUrl = useIssueUrl();

  // Right-aligned to the button like Fern's Radix popover (align end); where
  // that would cut off its left side (phones), it moves right until it starts
  // at the edge of the screen, as Fern's does.
  useLayoutEffect(() => {
    const el = popover.current;
    if (!el) return undefined;
    const place = () => {
      el.style.translate = '';
      const {left} = el.getBoundingClientRect();
      if (left < 0) el.style.translate = `${-left}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      // Open above the button, as Fern does, unless it would leave the viewport.
      const top = button.current?.getBoundingClientRect().top ?? 1000;
      setSide(top > 340 ? 'top' : 'bottom');
      setMessage('');
      setSent(null);
      track('code_block_feedback_opened', feedbackProperties(source));
    }
    setOpen(!open);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    // Fern sends the message as typed.
    track('code_block_feedback_submitted', {message, ...feedbackProperties(source)});
    setSent(issueUrl(text, getCode(), getLanguage?.() ?? 'text'));
  };

  return (
    <div className="fern-code__flag" ref={wrapper}>
      <button
        ref={button}
        type="button"
        className={clsx('fern-code__action', open && 'fern-code__action--open')}
        aria-label="Report incorrect code"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tooltip={open ? undefined : 'Report incorrect code'}
        onPointerEnter={measureTooltipRoom}
        onFocus={measureTooltipRoom}
        onClick={toggle}>
        <FlagIcon />
      </button>
      {open && (
        <div
          ref={popover}
          role="dialog"
          aria-label="Report incorrect code"
          className={clsx('fern-code-feedback', `fern-code-feedback--${side}`)}>
          {sent ? (
            <>
              <h2 className="fern-code-feedback__title">Thank you for your feedback!</h2>
              <p className="fern-code-feedback__text">
                Want to follow up?{' '}
                <a href={sent} target="_blank" rel="noopener noreferrer">
                  Open an issue on GitHub
                </a>{' '}
                with your report.
              </p>
              <div className="fern-code-feedback__buttons">
                <button type="button" className="fern-code-feedback__button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="fern-code-feedback__title">Report incorrect code</h2>
              <p className="fern-code-feedback__text">
                Help us improve our documentation by reporting what&apos;s wrong with this code example.
              </p>
              <form onSubmit={submit}>
                <textarea
                  className="fern-code-feedback__input"
                  rows={4}
                  placeholder="What's wrong with this code example?"
                  value={message}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="fern-code-feedback__buttons">
                  <button type="button" className="fern-code-feedback__button" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="fern-code-feedback__button fern-code-feedback__button--primary" disabled={!message.trim()}>
                    Submit
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The flag and copy pair. `flag={false}` keeps only copy (API reference panels). */
export default function CodeActions({
  getCode,
  getLanguage,
  getTab,
  className,
  flag = true,
}: CodeSource & {className?: string; flag?: boolean}): React.JSX.Element {
  return (
    <div className={clsx('fern-code__actions', className)}>
      {flag && <FlagButton getCode={getCode} getLanguage={getLanguage} getTab={getTab} />}
      <CopyButton getCode={getCode} />
    </div>
  );
}
