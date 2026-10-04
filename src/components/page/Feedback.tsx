// "Was this page helpful?" as on Fern. A vote marks the button and opens
// Fern's follow-up form (a reason, an optional comment and email) in a
// popover next to it; submitting replaces the row with a thank-you and shows
// a toast. Events keep Fern's names and payloads (feedback_voted,
// feedback_submitted) and go to PostHog and the GTM data layer when loaded.

import React, {useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {createRoot} from 'react-dom/client';

declare global {
  interface Window {
    posthog?: {capture: (event: string, properties?: Record<string, unknown>) => void};
  }
}

type Vote = 'yes' | 'no';

const QUESTION = 'Was this page helpful?';
const THANKS = 'Thank you for submitting feedback!';
// Fern linked its own policy because Fern kept the email; now Paradex does.
const PRIVACY_POLICY = 'https://www.paradex.trade/privacy-policy';

// Fern's reasons; the ids are what feedback_submitted reports.
const REASONS: Record<Vote, {id: string; title: string; description?: string}[]> = {
  yes: [
    {id: 'accurate', title: 'Accurate', description: 'Accurately describes the product or feature.'},
    {id: 'solved-my-issue', title: 'Solved my issue', description: 'Helped me resolve an issue.'},
    {id: 'easy-to-understand', title: 'Easy to understand', description: 'Easy to follow and comprehend.'},
    {id: 'product-adoption', title: 'Helped me decide to use the product', description: 'Convinced me to adopt the product or feature.'},
    {id: 'other', title: 'Another reason'},
  ],
  no: [
    {id: 'inaccurate', title: 'Inaccurate', description: "Doesn't accurately describe the product or feature."},
    {id: 'hard-to-follow', title: "Couldn't find what I was looking for", description: 'Missing important information.'},
    {id: 'hard-to-understand', title: 'Hard to understand', description: 'Too complicated or unclear.'},
    {id: 'code-sample-errors', title: 'Code sample errors', description: 'One or more code samples are incorrect.'},
    {id: 'other', title: 'Another reason'},
  ],
};

// Fern's track(): a 'fern-docs-track-analytics' event for page scripts, then
// {event, properties} to GTM and the event to PostHog. Fern kept the email
// out of both (only Fern saw it), so GTM still never gets it; PostHog does,
// with the reader's consent, as the one place left to follow up from.
function track(event: string, properties: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('fern-docs-track-analytics', {detail: {event, properties}}));
  window.posthog?.capture?.(event, properties);
  const {email, allowFollowUpViaEmail, ...withoutEmail} = properties;
  (window as unknown as {dataLayer?: unknown[]}).dataLayer?.push({event, properties: withoutEmail});
}

const ThumbUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);
const ThumbDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);
const CircleCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21.801 10A10 10 0 1 1 17 3.335" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

// Fern's comment box: two lines high, growing with its text.
function Comment({value, onChange, other}: {value: string; onChange: (value: string) => void; other: boolean}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = '';
    const twoLines = el.offsetHeight;
    el.style.height = '0px';
    el.style.height = `${Math.max(twoLines, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="doc-feedback__field"
      rows={2}
      aria-label="Tell us more about your experience"
      placeholder={other ? 'Tell us more about your experience' : '(Optional) Tell us more about your experience'}
      value={value}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={other}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type Submission = {reason: string; message: string; email?: string};

// The follow-up popover. Like Fern's Radix popover it sits 8px below the
// button, or above when only that fits, centred on it and kept inside the
// viewport; Escape and clicks outside close it, and Tab cycles within it.
function FollowUp({anchor, vote, onClose, onSubmit}: {
  anchor: HTMLButtonElement;
  vote: Vote;
  onClose: (refocus: boolean) => void;
  onSubmit: (submission: Submission) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [reason, setReason] = useState<string>();
  const [message, setMessage] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [email, setEmail] = useState('');

  useLayoutEffect(() => {
    const el = ref.current;
    const place = (keepInView: boolean) => {
      const button = anchor.getBoundingClientRect();
      const {offsetWidth: width, offsetHeight: height} = el;
      const below = window.innerHeight - button.bottom - 8;
      const above = button.top - 8;
      const bottom = height <= below || (height > above && below >= above);
      const left = Math.min(Math.max(button.left + button.width / 2 - width / 2, 0), document.documentElement.clientWidth - width);
      const top = bottom ? button.bottom + 8 : button.top - 8 - height;
      // Whole device pixels keep the text sharp.
      const round = (value: number) => Math.round(value * window.devicePixelRatio) / window.devicePixelRatio;
      el.style.left = `${round(left + window.scrollX)}px`;
      el.style.top = `${round(top + window.scrollY)}px`;
      el.dataset.side = bottom ? 'bottom' : 'top';
      // Unlike Fern's, a form that grows past the edge of the screen (on a
      // phone, once the comment and email fields open) scrolls back into view.
      const overflow = top < 0 ? top : Math.max(0, top + height - window.innerHeight);
      if (keepInView && overflow && height <= window.innerHeight) window.scrollBy({top: overflow, behavior: 'instant'});
    };
    const follow = () => place(false);
    place(true);
    el.focus({preventScroll: true});
    const observer = new ResizeObserver(() => place(true));
    observer.observe(el);
    window.addEventListener('scroll', follow, {passive: true});
    window.addEventListener('resize', follow);
    // As with Radix, a touch outside closes on the click that follows it, so
    // a finger scrolling the page (no click) leaves the form open.
    const closeOnClick = () => onClose(false);
    const onPointerDown = (event: PointerEvent) => {
      document.removeEventListener('click', closeOnClick);
      const target = event.target as Node;
      // A click on the button itself toggles the popover instead.
      if (el.contains(target) || anchor.contains(target)) return;
      if (event.pointerType === 'touch') document.addEventListener('click', closeOnClick, {once: true});
      else onClose(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', follow);
      window.removeEventListener('resize', follow);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', closeOnClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose]);

  // The radios are one tab stop and always the first; the submit button, or
  // the privacy link while it is disabled, is the last.
  const cycleFocus = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const el = ref.current;
    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type=radio]'));
    const submit = el.querySelector<HTMLButtonElement>('button[type=submit]');
    const first = radios.find((radio) => radio.checked) ?? radios[0];
    const last = submit.disabled ? el.querySelector('a') : submit;
    const active = document.activeElement;
    if (event.shiftKey ? active === el || radios.includes(active as HTMLInputElement) : active === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason) onSubmit({reason, message, email: followUp && email ? email : undefined});
  };

  return (
    <div ref={ref} className="doc-feedback__popover" role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} onKeyDown={cycleFocus}>
      <form onSubmit={submit}>
        <div id={`${id}-title`} className="doc-feedback__title">
          {vote === 'yes' ? 'What did you like?' : 'What went wrong?'}
        </div>
        <div className="doc-feedback__reasons" role="radiogroup" aria-labelledby={`${id}-title`}>
          {REASONS[vote].map((option) => (
            <div key={option.id}>
              <label className="doc-feedback__option">
                <input
                  type="radio"
                  className="doc-feedback__radio"
                  name={`${id}-reason`}
                  value={option.id}
                  checked={reason === option.id}
                  onChange={() => setReason(option.id)}
                />
                <span>
                  <span className="doc-feedback__option-title">{option.title}</span>
                  {option.description && <span className="doc-feedback__option-text">{option.description}</span>}
                </span>
              </label>
              {reason === option.id && <Comment value={message} onChange={setMessage} other={option.id === 'other'} />}
            </div>
          ))}
        </div>
        <hr className="doc-feedback__rule" />
        <label className="doc-feedback__option">
          <input
            type="checkbox"
            className="doc-feedback__checkbox"
            checked={followUp}
            onChange={(e) => {
              setFollowUp(e.target.checked);
              if (!e.target.checked) setEmail('');
            }}
          />
          <span className="doc-feedback__option-title">Yes, it&apos;s okay to follow up by email.</span>
        </label>
        {followUp && (
          <input
            type="email"
            className="doc-feedback__field doc-feedback__email"
            aria-label="Email"
            autoComplete="email"
            placeholder="yourname@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <p className="doc-feedback__privacy">
          Your email will only be used to follow up on this feedback.{' '}
          <a href={PRIVACY_POLICY} target="_blank" rel="noopener noreferrer">
            Privacy policy
          </a>
        </p>
        <button type="submit" className="doc-feedback__submit" disabled={!reason}>
          Feedback
        </button>
      </form>
    </div>
  );
}

// Fern's toaster is global, so the toast stays up when the reader moves on to
// another page; a newer one replaces it.
let hideToast = () => {};

function showToast() {
  hideToast();
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  root.render(
    <div className="doc-feedback-toast" role="status">
      <CircleCheck />
      {THANKS}
    </div>,
  );
  // Four seconds on screen, plus the slide in and out (see custom.css).
  const timer = window.setTimeout(() => hideToast(), 4400);
  hideToast = () => {
    window.clearTimeout(timer);
    root.unmount();
    container.remove();
    hideToast = () => {};
  };
}

const VOTES = [
  {vote: 'yes', label: 'Yes', Icon: ThumbUp},
  {vote: 'no', label: 'No', Icon: ThumbDown},
] as const;

export default function Feedback({permalink}: {permalink: string}) {
  const [vote, setVote] = useState<Vote>();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const buttons = useRef<Partial<Record<Vote, HTMLButtonElement>>>({});
  const thanks = useRef<HTMLSpanElement>(null);

  // Fern starts over on every page.
  useEffect(() => {
    setVote(undefined);
    setOpen(false);
    setSent(false);
  }, [permalink]);

  // Keep keyboard focus in the footer once the form is gone.
  useEffect(() => {
    if (sent) thanks.current?.focus();
  }, [sent]);

  const choose = (next: Vote) => {
    track('feedback_voted', {satisfied: next === 'yes', feedbackQuestion: QUESTION, type: 'on-page-feedback'});
    // A second click on the chosen answer closes its popover, as on Fern.
    setOpen(next !== vote || !open);
    setVote(next);
  };

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) buttons.current[vote]?.focus();
    },
    [vote],
  );

  const submit = ({reason, message, email}: Submission) => {
    track('feedback_submitted', {
      satisfied: vote === 'yes',
      feedback: reason,
      message,
      ...(email ? {email, allowFollowUpViaEmail: true} : {}),
      feedbackQuestion: QUESTION,
      type: 'on-page-feedback',
    });
    setOpen(false);
    setSent(true);
    showToast();
  };

  if (sent) {
    return (
      <div className="doc-feedback doc-feedback--sent">
        <span ref={thanks} tabIndex={-1}>
          {THANKS}
        </span>
      </div>
    );
  }
  return (
    <div className="doc-feedback">
      <span>{QUESTION}</span>
      {VOTES.map(({vote: option, label, Icon}) => (
        <button
          key={option}
          ref={(el) => {
            buttons.current[option] = el;
          }}
          type="button"
          className={vote === option ? `doc-feedback__vote--${option}` : undefined}
          aria-haspopup="dialog"
          aria-expanded={vote === option && open}
          onClick={() => choose(option)}>
          <Icon /> {label}
        </button>
      ))}
      {open &&
        vote &&
        createPortal(<FollowUp key={vote} anchor={buttons.current[vote]} vote={vote} onClose={close} onSubmit={submit} />, document.body)}
    </div>
  );
}
