// "Copy page" menu next to each page title, as on Fern: copies the page's
// Markdown (served at <page>.md by plugins/llms.mjs), opens it, or hands it
// to Claude or ChatGPT.
//
// The .md file starts with the agent preamble ("> For clean Markdown of any
// page, ..."); Fern's copied text had none, so it is removed before copying.

import React, {useEffect, useRef, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

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
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ExternalIcon = () => (
  <svg className="page-actions__external" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);
const MarkdownIcon = () => (
  <svg viewBox="0 0 24 15" fill="none" aria-hidden="true">
    <path
      d="M22.2692 0.576904H1.73075C1.0935 0.576904 0.576904 1.0935 0.576904 1.73075V13.0384C0.576904 13.6757 1.0935 14.1923 1.73075 14.1923H22.2692C22.9065 14.1923 23.4231 13.6757 23.4231 13.0384V1.73075C23.4231 1.0935 22.9065 0.576904 22.2692 0.576904Z"
      stroke="currentColor"
      strokeWidth="1.15"
    />
    <path
      d="M3.46155 11.3076V3.46143H5.76924L8.07693 6.34604L10.3846 3.46143H12.6923V11.3076H10.3846V6.80758L8.07693 9.6922L5.76924 6.80758V11.3076H3.46155ZM17.8846 11.3076L14.4231 7.49989H16.7308V3.46143H19.0385V7.49989H21.3462L17.8846 11.3076Z"
      fill="currentColor"
    />
  </svg>
);
const ClaudeIcon = () => (
  <svg viewBox="0 0 16 17" fill="none" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.218 2.52954H11.62L16 13.5162H13.598L9.218 2.52954ZM4.37933 2.52954H6.89067L11.2707 13.5162H8.82133L7.926 11.2089H3.34467L2.44867 13.5155H0L4.38 2.53087L4.37933 2.52954ZM7.134 9.16887L5.63533 5.30754L4.13667 9.16954H7.13333L7.134 9.16887Z"
      fill="currentColor"
    />
  </svg>
);
const OpenAIIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22.0606 9.86697C22.6034 8.23781 22.4165 6.45314 21.5485 4.97127C20.2431 2.69837 17.6188 1.52902 15.0558 2.0793C13.9156 0.794818 12.2774 0.0643507 10.5601 0.074818C7.94025 0.0688367 5.61576 1.75557 4.80978 4.24828C3.12679 4.59295 1.67408 5.64641 0.823986 7.13949C-0.491154 9.40641 -0.191341 12.264 1.56567 14.2079C1.02286 15.8371 1.20978 17.6217 2.07782 19.1036C3.38324 21.3765 6.00754 22.5458 8.57053 21.9956C9.70997 23.2801 11.3488 24.0105 13.0662 23.9993C15.6875 24.006 18.0128 22.3178 18.8188 19.8229C20.5017 19.4782 21.9545 18.4247 22.8045 16.9316C24.1182 14.6647 23.8176 11.8094 22.0614 9.86547L22.0606 9.86697ZM13.0677 22.4359C12.0188 22.4374 11.0027 22.0703 10.1974 21.3982C10.2341 21.3787 10.2976 21.3436 10.3388 21.3182L15.1029 18.5668C15.3466 18.4285 15.4961 18.169 15.4946 17.8886V11.1724L17.5081 12.335C17.5298 12.3455 17.544 12.3664 17.547 12.3903V17.9522C17.544 20.4255 15.541 22.4307 13.0677 22.4359ZM3.43483 18.3215C2.90922 17.4139 2.72006 16.35 2.90025 15.3174C2.93539 15.3384 2.99744 15.3765 3.04156 15.4019L7.80567 18.1533C8.04716 18.2946 8.34623 18.2946 8.58847 18.1533L14.4045 14.7948V17.1201C14.406 17.144 14.3948 17.1672 14.3761 17.1821L9.56044 19.9627C7.41539 21.1978 4.67595 20.4636 3.43558 18.3215H3.43483ZM2.181 7.92229C2.70436 7.01314 3.53053 6.31781 4.51445 5.95669C4.51445 5.99781 4.51221 6.07033 4.51221 6.12117V11.6247C4.51072 11.9043 4.66025 12.1638 4.90324 12.3021L10.7193 15.6599L8.70586 16.8225C8.68567 16.8359 8.66025 16.8382 8.63782 16.8285L3.82137 14.0457C1.68081 12.806 0.946603 10.0673 2.18025 7.92304L2.181 7.92229ZM18.7238 11.772L12.9077 8.41351L14.9212 7.25164C14.9414 7.23818 14.9668 7.23594 14.9892 7.24566L19.8057 10.0262C21.95 11.2651 22.6849 14.0083 21.446 16.1526C20.9219 17.0602 20.0965 17.7556 19.1133 18.1174V12.4494C19.1156 12.1698 18.9668 11.9111 18.7245 11.772H18.7238ZM20.7275 8.75594C20.6924 8.73426 20.6303 8.69687 20.5862 8.67145L15.8221 5.92005C15.5806 5.77874 15.2816 5.77874 15.0393 5.92005L9.22324 9.27856V6.95332C9.22174 6.9294 9.23296 6.90622 9.25165 6.89127L14.0674 4.11295C16.2124 2.87557 18.9548 3.61201 20.1915 5.75781C20.7141 6.66398 20.9032 7.72491 20.726 8.75594H20.7275ZM8.12866 12.9002L6.11445 11.7376C6.09277 11.7272 6.07857 11.7062 6.07558 11.6823V6.12043C6.07707 3.64416 8.08604 1.63743 10.5623 1.63893C11.6098 1.63893 12.6236 2.00678 13.4288 2.67669C13.3922 2.69613 13.3294 2.73127 13.2875 2.75669L8.52343 5.50809C8.27969 5.64641 8.13016 5.9051 8.13165 6.18547L8.12866 12.8987V12.9002ZM9.22249 10.5421L11.8131 9.04603L14.4038 10.5414V13.5328L11.8131 15.0281L9.22249 13.5328V10.5421Z"
      fill="currentColor"
    />
  </svg>
);

type Item = {icon: React.ReactNode; title: string; subtitle: string} & ({onSelect: () => void} | {href: string});

const PREAMBLE_START = '> For clean Markdown of any page, append .md to the page URL.';

/** The page's Markdown without the leading agent preamble blockquote. */
function stripAgentPreamble(markdown: string): string {
  if (!markdown.startsWith(PREAMBLE_START)) return markdown;
  const lines = markdown.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].startsWith('>')) i++;
  while (i < lines.length && lines[i].trim() === '') i++;
  return lines.slice(i).join('\n');
}

export default function PageActions({permalink}: {permalink: string}): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const markdownPath = `${permalink.replace(/\/$/, '')}.md`;
  const markdownUrl = `${siteConfig.url}${markdownPath}`;
  const prompt = encodeURIComponent(`Read ${markdownUrl} so I can ask questions about it.`);

  const close = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      const response = await fetch(markdownPath);
      // Only real Markdown: behind the edge layer a missing .md answers 200
      // text/plain with the agent "Page Not Found" text.
      const isMarkdown = response.ok && (response.headers.get('content-type') ?? '').includes('text/markdown');
      const text = isMarkdown ? stripAgentPreamble(await response.text()) : document.querySelector('article')?.innerText ?? '';
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
    close();
  };

  const items: Item[] = [
    {icon: <CopyIcon />, title: 'Copy page', subtitle: 'Copy this page as Markdown for LLMs', onSelect: copy},
    {icon: <MarkdownIcon />, title: 'View as Markdown', subtitle: 'View this page as plain text', href: markdownPath},
    {icon: <ClaudeIcon />, title: 'Open in Claude', subtitle: 'Ask questions about this page', href: `https://claude.ai/new?q=${prompt}`},
    {icon: <OpenAIIcon />, title: 'Open in ChatGPT', subtitle: 'Ask questions about this page', href: `https://chat.openai.com/?hint=search&q=${prompt}`},
  ];

  return (
    <div className="page-actions" ref={ref}>
      <button type="button" className="page-actions__button" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy page'}
      </button>
      <button
        ref={trigger}
        type="button"
        className="page-actions__button"
        aria-label="More page actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <ChevronIcon />
      </button>
      {open && (
        <div className="page-actions__menu" role="menu" ref={menu}>
          {items.map((item) => {
            const body = (
              <>
                <span className="page-actions__icon">{item.icon}</span>
                <span className="page-actions__text">
                  <span>{item.title}</span>
                  <small>{item.subtitle}</small>
                </span>
                {'href' in item && <ExternalIcon />}
              </>
            );
            return 'href' in item ? (
              <a
                key={item.title}
                className="page-actions__item"
                role="menuitem"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close()}>
                {body}
              </a>
            ) : (
              <button key={item.title} type="button" className="page-actions__item" role="menuitem" onClick={item.onSelect}>
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
