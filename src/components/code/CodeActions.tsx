// Fern's code block toolbar: borderless "Report incorrect code" (flag) and
// "Copy to clipboard" icon buttons. The flag opens Fern's feedback popover;
// a report is sent to the analytics the page feedback already uses (PostHog
// and the GTM data layer) and offers a prefilled GitHub issue.

import React, {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type CodeSource = {getCode: () => string; getLanguage?: () => string};

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
      onClick={onClick}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

type Analytics = {
  posthog?: {capture?: (event: string, properties?: Record<string, unknown>) => void};
  dataLayer?: unknown[];
};

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

export function FlagButton({getCode, getLanguage}: CodeSource): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'top' | 'bottom'>('top');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const issueUrl = useIssueUrl();

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
    }
    setOpen(!open);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const code = getCode();
    const language = getLanguage?.() ?? 'text';
    const properties = {path: window.location.pathname, message: text, language, code: code.slice(0, 1000)};
    const w = window as unknown as Analytics;
    w.posthog?.capture?.('docs_code_feedback', properties);
    w.dataLayer?.push({event: 'docs_code_feedback', ...properties});
    setSent(issueUrl(text, code, language));
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
        onClick={toggle}>
        <FlagIcon />
      </button>
      {open && (
        <div role="dialog" aria-label="Report incorrect code" className={clsx('fern-code-feedback', `fern-code-feedback--${side}`)}>
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
  className,
  flag = true,
}: CodeSource & {className?: string; flag?: boolean}): React.JSX.Element {
  return (
    <div className={clsx('fern-code__actions', className)}>
      {flag && <FlagButton getCode={getCode} getLanguage={getLanguage} />}
      <CopyButton getCode={getCode} />
    </div>
  );
}
