// Right-hand panels of the API reference, as on Fern: a header with the
// panel's controls and always-visible copy/expand buttons, a code body that
// scrolls on its own, an optional footer, and the full-width "expand" view.

import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import Icon from '@site/src/components/fern/Icon';
import {CheckIcon, ChevronDownIcon, CloseIcon, CopyIcon, MaximizeIcon} from './icons';
import type {Sample} from './types';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    copied,
    (text: string) => {
      const done = () => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    },
  ];
}

export function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" className={clsx('api-icon-button', className)} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function CopyButton({text, className}: {text: string | (() => string); className?: string}) {
  const [copied, copy] = useCopy();
  return (
    <IconButton
      label={copied ? 'Copied' : 'Copy to clipboard'}
      className={clsx('api-copy-button', copied && 'api-copy-button--copied', className)}
      onClick={() => copy(typeof text === 'function' ? text() : text)}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </IconButton>
  );
}

/** Close a popup on outside click or Escape. */
function useDismiss(open: boolean, close: () => void, refs: Array<React.RefObject<HTMLElement | null>>) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, refs]);
}

/** Arrow-key navigation between the items of an open menu. */
function onMenuKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
  e.preventDefault();
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitemradio],[role=option]'));
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
  items[next]?.focus();
}

/* ---------- Languages ---------- */

const LANGUAGE_KEY = 'paradex-docs-api-language';
const LANGUAGE_EVENT = 'paradex-docs-api-language';

// Font Awesome names (resolved at build time by plugins/icons.mjs).
const LANGUAGE_ICONS: Record<string, {icon: string}> = {
  curl: {icon: 'fa-solid fa-terminal'},
  csharp: {icon: 'fa-brands fa-microsoft'},
  go: {icon: 'fa-brands fa-golang'},
  java: {icon: 'fa-brands fa-java'},
  javascript: {icon: 'fa-brands fa-js'},
  typescript: {icon: 'fa-brands fa-js'},
  php: {icon: 'fa-brands fa-php'},
  python: {icon: 'fa-brands fa-python'},
  ruby: {icon: 'fa-solid fa-gem'},
  rust: {icon: 'fa-brands fa-rust'},
  swift: {icon: 'fa-brands fa-swift'},
};

export function LanguageIcon({language}: {language: string}) {
  const icon = LANGUAGE_ICONS[language]?.icon;
  return <span className="api-lang-icon">{icon ? <Icon icon={icon} /> : null}</span>;
}

/** The chosen code language, remembered and shared by every panel and page. */
export function useLanguage(samples: Sample[]) {
  const [language, setLanguage] = useState(samples[0]?.language);
  useEffect(() => {
    const sync = () => {
      try {
        const saved = window.localStorage.getItem(LANGUAGE_KEY);
        if (saved && samples.some((s) => s.language === saved)) setLanguage(saved);
      } catch {
        /* storage unavailable */
      }
    };
    sync();
    window.addEventListener(LANGUAGE_EVENT, sync);
    return () => window.removeEventListener(LANGUAGE_EVENT, sync);
  }, [samples]);
  const choose = (value: string) => {
    setLanguage(value);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  };
  return [samples.find((s) => s.language === language) ?? samples[0], choose] as const;
}

export function LanguageMenu({samples, value, onChange}: {samples: Sample[]; value: Sample; onChange: (language: string) => void}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrap]);
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[aria-checked=true]')?.focus();
  }, [open]);
  return (
    <div className="api-lang" ref={wrap}>
      <button
        type="button"
        className="api-lang__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${value.label}`}
        onClick={() => setOpen(!open)}>
        <LanguageIcon language={value.language} />
        <span className="api-lang__label">{value.label}</span>
        <ChevronDownIcon className="api-lang__chevron" />
      </button>
      {open && (
        <div className="api-menu api-lang__menu" role="menu" ref={menu} onKeyDown={onMenuKeyDown}>
          {samples.map((s) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={s.language === value.language}
              key={s.language}
              className="api-menu__item"
              onClick={() => {
                onChange(s.language);
                setOpen(false);
              }}>
              <LanguageIcon language={s.language} />
              <span className="api-menu__label">{s.label}</span>
              {s.language === value.language && <CheckIcon className="api-menu__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Response status ---------- */

export type StatusOption = {status: string; label: string; error?: boolean};

export function StatusBadge({status, error, small = false}: {status: string; error?: boolean; small?: boolean}) {
  return (
    <span className={clsx('api-status-badge', error ? 'api-status-badge--error' : 'api-status-badge--success', small && 'api-status-badge--small')}>
      {status}
    </span>
  );
}

function StatusLabel({option}: {option: StatusOption}) {
  return (
    <span className="api-status">
      <StatusBadge status={option.status} error={option.error} />
      <span className={clsx('api-status__label', option.error ? 'api-status__label--error' : 'api-status__label--success')}>
        {option.label}
      </span>
    </span>
  );
}

/** Fern's response switcher: "201 Created ⌄", listing success and error responses. */
export function StatusSelect({options, value, onChange}: {options: StatusOption[]; value: number; onChange: (index: number) => void}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrap]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[aria-selected=true]')?.focus();
  }, [open]);
  const current = options[value] ?? options[0];
  if (!current) return null;
  if (options.length < 2) return <StatusLabel option={current} />;
  return (
    <div className="api-status-select" ref={wrap}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Response: ${current.status} ${current.label}`}
        className={clsx('api-status-select__button', current.error && 'api-status-select__button--error')}
        onClick={() => setOpen(!open)}>
        <StatusLabel option={current} />
        <ChevronDownIcon className="api-status-select__chevron" />
      </button>
      {open && (
        <div
          className="api-listbox"
          role="listbox"
          ref={list}
          onKeyDown={onMenuKeyDown}
          // The selected option sits over the button, as a native select does.
          style={{top: `${-5 - value * 32}px`}}>
          {options.map((option, i) => (
            <div
              role="option"
              tabIndex={-1}
              aria-selected={i === value}
              key={option.status}
              className={clsx('api-listbox__option', option.error && 'api-listbox__option--error')}
              onClick={() => {
                onChange(i);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(i);
                  setOpen(false);
                }
              }}>
              <StatusLabel option={option} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Code panel ---------- */

/** Full-width view of a snippet (Fern's "Expand code"). */
export function CodeModal({code, onClose}: {code: string; onClose: () => void}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const root = document.documentElement;
    root.classList.add('api-code-modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      root.classList.remove('api-code-modal-open');
    };
  }, [onClose]);
  return createPortal(
    <div className="api-code-modal" role="dialog" aria-modal="true" aria-label="Code">
      <div className="api-code-modal__backdrop" onClick={onClose} />
      <div className="api-code-modal__card">
        <div className="api-code-modal__actions">
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <CopyButton text={code} />
        </div>
        <div className="api-code-modal__body">
          <CodeBlock language="text" showLineNumbers className="api-code-modal__code">
            {code}
          </CodeBlock>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** True while the element's content is taller than the element. */
export function useOverflow(ref: React.RefObject<HTMLElement | null>, deps: unknown[], axis: 'x' | 'y' = 'y') {
  const [overflowing, setOverflowing] = useState(false);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () =>
      setOverflowing(axis === 'x' ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return overflowing;
}

export function CodePanel({
  header,
  controls,
  code,
  language,
  lineNumbers = true,
  footer,
  className,
}: {
  header: React.ReactNode;
  controls?: React.ReactNode;
  code: string;
  language: string;
  lineNumbers?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const overflowing = useOverflow(body, [code]);
  const closeModal = useCallback(() => setExpanded(false), []);
  return (
    <div className={clsx('api-panel', className)}>
      <div className="api-panel__header">
        <div className="api-panel__heading">{header}</div>
        <div className="api-panel__controls">
          {controls}
          {overflowing && (
            <IconButton label="Expand code" className="api-expand-button" onClick={() => setExpanded(true)}>
              <MaximizeIcon />
            </IconButton>
          )}
          <CopyButton text={code} />
        </div>
      </div>
      <div className="api-panel__body" ref={body} tabIndex={-1}>
        <CodeBlock language={language} showLineNumbers={lineNumbers} className="api-panel__code">
          {code}
        </CodeBlock>
      </div>
      {footer && <div className="api-panel__footer">{footer}</div>}
      {expanded && <CodeModal code={code} onClose={closeModal} />}
    </div>
  );
}
