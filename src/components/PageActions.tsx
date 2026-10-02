// "Copy page" menu next to each page title, as on Fern: copies the page's
// Markdown (served at <page>.md by plugins/llms.mjs), or opens it.

import React, {useEffect, useRef, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
);
const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export default function PageActions({permalink}: {permalink: string}): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const markdownPath = `${permalink.replace(/\/$/, '')}.md`;
  const markdownUrl = `${siteConfig.url}${markdownPath}`;
  const prompt = encodeURIComponent(`Read ${markdownUrl} so I can ask questions about it.`);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const copy = async () => {
    try {
      const response = await fetch(markdownPath);
      const text = response.ok ? await response.text() : document.querySelector('article')?.innerText ?? '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
    setOpen(false);
  };

  return (
    <div className="page-actions" ref={ref}>
      <button type="button" className="page-actions__button" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy page'}
      </button>
      <button
        type="button"
        className="page-actions__button"
        aria-label="More page actions"
        aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <ChevronIcon />
      </button>
      {open && (
        <div className="page-actions__menu" role="menu">
          <button type="button" className="page-actions__item" role="menuitem" onClick={copy}>
            <CopyIcon />
            <span>
              Copy page
              <small>Copy this page as Markdown for LLMs</small>
            </span>
          </button>
          <a className="page-actions__item" role="menuitem" href={markdownPath} target="_blank" rel="noopener">
            <FileIcon />
            <span>
              View as Markdown
              <small>Open this page in Markdown</small>
            </span>
          </a>
          <a className="page-actions__item" role="menuitem" href={`https://chatgpt.com/?hints=search&q=${prompt}`} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            <span>
              Open in ChatGPT
              <small>Ask questions about this page</small>
            </span>
          </a>
          <a className="page-actions__item" role="menuitem" href={`https://claude.ai/new?q=${prompt}`} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            <span>
              Open in Claude
              <small>Ask questions about this page</small>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
