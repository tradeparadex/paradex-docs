// "Try it": Fern's API explorer, rebuilt. It opens over an endpoint page at
// `?explorer=true`, builds the request from a form generated from the
// endpoint's schema, shows it as cURL/JavaScript/Python, and sends it
// straight from the browser (Fern relayed it through its own proxy).

import React, {useEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import {useHistory, useLocation} from '@docusaurus/router';
import {useDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import type {PropSidebarItem} from '@docusaurus/plugin-content-docs';
import MethodBadge from './MethodBadge';
import type {Endpoint, Property, Shape} from './types';

const AUTH_KEY = 'paradex-docs-api-auth';
const NUMBER_LABELS = new Set(['integer', 'long', 'double']);

export type Values = Record<string, unknown>;
type FormState = {path: Values; query: Values; headers: Values; body: unknown};
type Result =
  | {state: 'idle'}
  | {state: 'loading'}
  | {state: 'done'; status: number; statusText: string; ms: number; body: string; json: boolean}
  | {state: 'failed'; message: string};

/* ---------- Icons ---------- */

const Svg = ({children, className}: {children: React.ReactNode; className?: string}) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
const SendIcon = () => (
  <Svg>
    <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
    <path d="M6 12h16" />
  </Svg>
);
export const CloseIcon = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
const KeyIcon = () => (
  <Svg>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2" />
  </Svg>
);
const LockIcon = () => (
  <Svg>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
const EyeIcon = () => (
  <Svg>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
const EyeOffIcon = () => (
  <Svg>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Svg>
);
const HelpIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  </Svg>
);
const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);
const PlusCircleIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
const ExpandIcon = () => (
  <Svg>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </Svg>
);
const ChevronIcon = () => (
  <Svg>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

/* ---------- Values ---------- */

const plainText = (html?: string) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** The value a field starts with when it is added to the form. */
export function emptyValue(shape: Shape): unknown {
  switch (shape.kind) {
    case 'enum':
      return shape.values?.[0] ?? '';
    case 'object':
      return Object.fromEntries((shape.properties ?? []).filter((p) => p.required).map((p) => [p.name, emptyValue(p.shape)]));
    case 'array':
      return [];
    case 'map':
      return {};
    case 'primitive':
      if (NUMBER_LABELS.has(shape.label)) return 0;
      if (shape.label === 'boolean') return false;
      return '';
    default:
      return '';
  }
}

const isSet = (value: unknown) => value !== undefined && value !== '';

function initialState(endpoint: Endpoint): FormState {
  const example = endpoint.example;
  return {
    path: {...(example?.path ?? {})},
    query: {...(example?.query ?? {})},
    headers: {...(example?.headers ?? {})},
    body: example?.body ?? (endpoint.requestBody ? emptyValue(endpoint.requestBody.shape) : undefined),
  };
}

function clearedState(endpoint: Endpoint): FormState {
  const blank = (props?: Property[]) => Object.fromEntries((props ?? []).filter((p) => p.required).map((p) => [p.name, '']));
  return {
    path: blank(endpoint.pathParams),
    query: blank(endpoint.queryParams),
    headers: blank(endpoint.headerParams),
    body: endpoint.requestBody ? emptyValue(endpoint.requestBody.shape) : undefined,
  };
}

/* ---------- Request ---------- */

type BuiltRequest = {
  method: string;
  url: string;
  query: Array<[string, string]>;
  headers: Array<[string, string]>;
  body?: unknown;
};

function buildRequest(endpoint: Endpoint, state: FormState, auth: string): BuiltRequest {
  const path = endpoint.path.replace(/\{([^}]+)\}/g, (_, name: string) => encodeURIComponent(String(state.path[name] ?? '')));
  const query: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(state.query)) {
    if (!isSet(value)) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.push([name, String(item)]);
  }
  const headers: Array<[string, string]> = [];
  if (endpoint.auth) headers.push([endpoint.auth.name, auth]);
  for (const [name, value] of Object.entries(state.headers)) if (isSet(value)) headers.push([name, String(value)]);
  const hasBody = endpoint.requestBody !== undefined && state.body !== undefined;
  if (hasBody) headers.push(['Content-Type', 'application/json']);
  return {method: endpoint.method, url: endpoint.server + path, query, headers, ...(hasBody ? {body: state.body} : {})};
}

/** How Fern showed a credential in the snippets; Copy and Send use it as typed. */
const maskSecret = (value: string) =>
  value.trimEnd() === ''
    ? value
    : value.length < 28
      ? `${value.slice(0, 1)}${'*'.repeat(25)}${value.slice(-2)}`
      : `${value.slice(0, 12)}....${value.slice(-12)}`;

const fullUrl = (req: BuiltRequest) => (req.query.length ? `${req.url}?${new URLSearchParams(req.query).toString()}` : req.url);
const indent = (text: string, by: string) => text.replace(/\n/g, `\n${by}`);

function curlSnippet(req: BuiltRequest): string {
  const lines: string[] = [];
  const method = req.method.toLowerCase();
  if (method === 'get') lines.push(req.query.length ? `curl -G ${req.url}` : `curl ${req.url}`);
  else lines.push(`curl -X ${req.method} ${req.url}`);
  for (const [name, value] of req.headers) lines.push(`-H "${name}: ${value}"`);
  for (const [name, value] of req.query) lines.push(`-d ${name}=${encodeURIComponent(value)}`);
  if (req.body !== undefined) lines.push(`-d '${JSON.stringify(req.body, null, 2)}'`);
  return lines.map((line, i) => (i === 0 ? line : `     ${line}`)).join(' \\\n');
}

function javascriptSnippet(req: BuiltRequest, comment: string): string {
  const out = [`// ${comment}`, `const response = await fetch(${JSON.stringify(fullUrl(req))}, {`, `  method: ${JSON.stringify(req.method)},`];
  if (req.headers.length) {
    out.push('  headers: {', req.headers.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n'), '  },');
  }
  if (req.body !== undefined) out.push(`  body: JSON.stringify(${indent(JSON.stringify(req.body, null, 2), '  ')}),`);
  out.push('});', '', 'const body = await response.json();', 'console.log(body);');
  return out.join('\n');
}

function pythonSnippet(req: BuiltRequest, comment: string): string {
  const out = ['import requests', '', `# ${comment}`, `response = requests.${req.method.toLowerCase()}(`, `  ${JSON.stringify(fullUrl(req))},`];
  if (req.headers.length) {
    out.push('  headers={', req.headers.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n'), '  },');
  }
  if (req.body !== undefined) out.push(`  json=${indent(JSON.stringify(req.body, null, 2), '  ')},`);
  out.push(')', '', 'print(response.json())');
  return out.join('\n');
}

const SNIPPETS = [
  {id: 'curl', label: 'cURL', prism: 'bash'},
  {id: 'javascript', label: 'JavaScript', prism: 'javascript'},
  {id: 'python', label: 'Python', prism: 'python'},
] as const;

/* ---------- Form fields ---------- */

function FieldLabel({prop}: {prop: Property}) {
  const description = plainText(prop.shape.description);
  return (
    <div className="api-explorer__label">
      <code className="api-explorer__name">{prop.name}</code>
      {description && (
        <span className="api-explorer__help" title={description}>
          <HelpIcon />
        </span>
      )}
      <span className="api-explorer__type">{prop.shape.label}</span>
      {prop.required ? <span className="api-explorer__required">Required</span> : <span className="api-explorer__optional">Optional</span>}
    </div>
  );
}

function TextInput({value, onChange, placeholder}: {value: string; onChange: (v: string) => void; placeholder?: string}) {
  return (
    <div className="api-explorer__input">
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value !== '' && (
        <button type="button" className="api-explorer__clear" aria-label="Clear" onClick={() => onChange('')}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function NumberInput({value, onChange, integer}: {value: unknown; onChange: (v: unknown) => void; integer: boolean}) {
  const current = value === '' || value === undefined ? '' : String(value);
  const step = (delta: number) => onChange((Number(current) || 0) + delta);
  return (
    <div className="api-explorer__number">
      <button type="button" aria-label="Decrease" onClick={() => step(-1)}>
        −
      </button>
      <input
        type="number"
        step={integer ? 1 : 'any'}
        value={current}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <button type="button" aria-label="Increase" onClick={() => step(1)}>
        +
      </button>
    </div>
  );
}

function JsonInput({value, onChange}: {value: unknown; onChange: (v: unknown) => void}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [invalid, setInvalid] = useState(false);
  return (
    <textarea
      className={clsx('api-explorer__json', invalid && 'api-explorer__json--invalid')}
      value={text}
      rows={Math.min(12, text.split('\n').length + 1)}
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(JSON.parse(e.target.value));
          setInvalid(false);
        } catch {
          setInvalid(true);
        }
      }}
    />
  );
}

/** Input for a scalar (or a JSON editor for shapes a form can't express). */
function ValueInput({shape, value, onChange}: {shape: Shape; value: unknown; onChange: (v: unknown) => void}) {
  if (shape.kind === 'enum') {
    const current = String(value ?? '');
    return (
      <div className={clsx('api-explorer__select', current === '' && 'api-explorer__select--empty')}>
        <select value={current} onChange={(e) => onChange(e.target.value)}>
          {current === '' ? (
            <option value="" disabled>
              Select an enum...
            </option>
          ) : (
            !shape.values?.includes(current) && <option value={current}>{current}</option>
          )}
          {shape.values?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
    );
  }
  if (shape.kind === 'primitive') {
    if (NUMBER_LABELS.has(shape.label)) return <NumberInput value={value} onChange={onChange} integer={shape.label !== 'double'} />;
    if (shape.label === 'boolean') {
      return (
        <label className="api-explorer__switch">
          <input type="checkbox" checked={value === true || value === 'true'} onChange={(e) => onChange(e.target.checked)} />
          <span aria-hidden="true" />
          {String(value === true || value === 'true')}
        </label>
      );
    }
    return <TextInput value={value === undefined || value === null ? '' : String(value)} onChange={onChange} />;
  }
  return <JsonInput value={value} onChange={onChange} />;
}

function ArrayInput({shape, value, onChange}: {shape: Shape; value: unknown; onChange: (v: unknown) => void}) {
  const items = Array.isArray(value) ? value : [];
  const itemShape = shape.items ?? {kind: 'unknown', label: 'any'};
  return (
    <div className="api-explorer__array">
      {items.map((item, i) => (
        <div key={i} className="api-explorer__array-item">
          <div className="api-explorer__array-value">
            <FieldValue shape={itemShape} value={item} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
          </div>
          <button type="button" className="api-explorer__remove" aria-label="Remove item" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <CloseIcon />
          </button>
        </div>
      ))}
      <button type="button" className="api-explorer__add" onClick={() => onChange([...items, emptyValue(itemShape)])}>
        <PlusCircleIcon /> Add new item
      </button>
    </div>
  );
}

export function FieldValue({shape, value, onChange}: {shape: Shape; value: unknown; onChange: (v: unknown) => void}) {
  if (shape.kind === 'object' && shape.properties?.length) {
    return (
      <ObjectFields
        properties={shape.properties}
        value={(value && typeof value === 'object' ? value : {}) as Values}
        onChange={onChange}
        nested
      />
    );
  }
  if (shape.kind === 'array') return <ArrayInput shape={shape} value={value} onChange={onChange} />;
  return <ValueInput shape={shape} value={value} onChange={onChange} />;
}

const isBlock = (shape: Shape) => (shape.kind === 'object' && Boolean(shape.properties?.length)) || shape.kind === 'array';

function OptionalProperties({properties, onAdd}: {properties: Property[]; onAdd: (p: Property) => void}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="api-explorer__optional-wrap" ref={ref}>
      {open && (
        <div className="api-explorer__menu" role="menu">
          {properties.map((p) => (
            <button
              type="button"
              role="menuitem"
              key={p.name}
              className="api-explorer__menu-item"
              onClick={() => {
                onAdd(p);
                setOpen(false);
              }}>
              <span className="api-explorer__menu-text">
                <code>{p.name}</code>
                <span>
                  {p.shape.label}
                  {p.shape.constraints?.map((c) => (
                    <span key={c} className="api-explorer__constraint">
                      {c}
                    </span>
                  ))}
                </span>
              </span>
              {p.shape.description && (
                <span className="api-explorer__menu-info" title={plainText(p.shape.description)}>
                  <InfoIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="api-explorer__more" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="api-explorer__more-count">
          {properties.length} more optional {properties.length === 1 ? 'property' : 'properties'}
        </span>
        <code className="api-explorer__more-names">{properties.map((p) => p.name).join(', ')}</code>
        <PlusCircleIcon />
      </button>
    </div>
  );
}

export function ObjectFields({
  properties,
  value,
  onChange,
  nested = false,
}: {
  properties: Property[];
  value: Values;
  onChange: (v: Values) => void;
  nested?: boolean;
}) {
  const shown = properties.filter((p) => p.required || p.name in value);
  const hidden = properties.filter((p) => !p.required && !(p.name in value));
  const set = (name: string, v: unknown) => onChange({...value, [name]: v});
  const remove = (name: string) => {
    const next = {...value};
    delete next[name];
    onChange(next);
  };
  return (
    <div className={clsx('api-explorer__fields', nested && 'api-explorer__fields--nested')}>
      {shown.map((prop) => (
        <div key={prop.name} className={clsx('api-explorer__field', isBlock(prop.shape) && 'api-explorer__field--block')}>
          <FieldLabel prop={prop} />
          <div className="api-explorer__control">
            <FieldValue shape={prop.shape} value={value[prop.name]} onChange={(v) => set(prop.name, v)} />
            {!prop.required && (
              <button type="button" className="api-explorer__remove" aria-label={`Remove ${prop.name}`} onClick={() => remove(prop.name)}>
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
      ))}
      {hidden.length > 0 && <OptionalProperties properties={hidden} onAdd={(p) => set(p.name, emptyValue(p.shape))} />}
    </div>
  );
}

export function FormSection({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section className="api-explorer__section">
      <h4 className="api-explorer__section-title">{title}</h4>
      <div className="api-explorer__card">{children}</div>
    </section>
  );
}

function AuthCard({name, value, onChange}: {name: string; value: string; onChange: (v: string) => void}) {
  const [open, setOpen] = useState(value === '');
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <div className={clsx('api-explorer__auth-banner', value ? 'api-explorer__auth-banner--ok' : 'api-explorer__auth-banner--missing')}>
        <KeyIcon />
        <span>Enter your credentials ({name})</span>
        <button type="button" onClick={() => setOpen(!open)}>
          Edit
        </button>
      </div>
      {open && (
        <div className="api-explorer__card api-explorer__auth">
          <label className="api-explorer__auth-label" htmlFor="api-explorer-auth">
            {name}
          </label>
          <div className="api-explorer__input api-explorer__input--secret">
            <LockIcon />
            <input
              id="api-explorer-auth"
              type={revealed ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <button
              type="button"
              className="api-explorer__reveal"
              aria-label={revealed ? 'Hide password' : 'Show password'}
              onClick={() => setRevealed(!revealed)}>
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <div className="api-explorer__auth-actions">
            <button type="button" className="api-explorer__button" onClick={() => setOpen(false)}>
              Close
            </button>
            <button type="button" className="api-explorer__button" onClick={() => onChange('')}>
              Reset
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Panels ---------- */

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    (text: string) => {
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    },
  ];
}

function RequestPanel({
  req,
  shown,
  comment,
  expanded,
  onExpand,
}: {
  req: BuiltRequest;
  /** The request as displayed, with the credential masked. */
  shown: BuiltRequest;
  comment: string;
  expanded: boolean;
  onExpand: () => void;
}) {
  const [language, setLanguage] = useState<(typeof SNIPPETS)[number]['id']>('curl');
  const [copied, copy] = useCopy();
  const snippet = (r: BuiltRequest) =>
    language === 'curl' ? curlSnippet(r) : language === 'javascript' ? javascriptSnippet(r, comment) : pythonSnippet(r, comment);
  const code = snippet(shown);
  const prism = SNIPPETS.find((s) => s.id === language)!.prism;
  return (
    <div className={clsx('api-explorer__panel', expanded && 'api-explorer__panel--expanded')}>
      <div className="api-explorer__panel-header">
        <span className="api-explorer__panel-title">Request</span>
        <div className="api-explorer__tabs" role="tablist">
          {SNIPPETS.map((s) => (
            <button
              type="button"
              role="tab"
              key={s.id}
              aria-selected={language === s.id}
              className={clsx('api-explorer__tab', language === s.id && 'api-explorer__tab--active')}
              onClick={() => setLanguage(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="api-explorer__icon-button" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onExpand}>
          <ExpandIcon />
        </button>
        <button type="button" className="api-explorer__icon-button" aria-label="Copy request" onClick={() => copy(snippet(req))}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <div className="api-explorer__panel-body">
        <CodeBlock language={prism} showLineNumbers={language !== 'curl'} className="api-explorer__code">
          {code}
        </CodeBlock>
      </div>
    </div>
  );
}

function ResponsePanel({result, onSend}: {result: Result; onSend: () => void}) {
  return (
    <div className="api-explorer__panel api-explorer__panel--response">
      <div className="api-explorer__panel-header">
        <span className="api-explorer__panel-title">Response</span>
        {result.state === 'done' && (
          <span className="api-explorer__response-meta">
            <span className={clsx('api-explorer__status', result.status < 400 ? 'api-explorer__status--ok' : 'api-explorer__status--error')}>
              {result.status} {result.statusText}
            </span>
            <span className="api-explorer__time">{result.ms}ms</span>
          </span>
        )}
        {result.state === 'failed' && <span className="api-explorer__status api-explorer__status--error">Failed</span>}
      </div>
      <div className="api-explorer__panel-body api-explorer__panel-body--response">
        {result.state === 'idle' && (
          <button type="button" className="api-explorer__send api-explorer__send--center" onClick={onSend}>
            Send request
          </button>
        )}
        {result.state === 'loading' && <div className="api-explorer__loading" aria-label="Sending" />}
        {result.state === 'failed' && (
          <div className="api-explorer__failed">
            <span className="api-explorer__failed-badge">Something went wrong!</span>
            <p>{result.message}</p>
          </div>
        )}
        {result.state === 'done' && (
          <CodeBlock language={result.json ? 'json' : 'text'} showLineNumbers className="api-explorer__code">
            {result.body || ' '}
          </CodeBlock>
        )}
      </div>
    </div>
  );
}

/* ---------- Endpoint list ---------- */

type NavGroup = {title: string; section: string; group: string; items: Array<{label: string; href: string; method: string}>};

function linksOf(items: PropSidebarItem[]): Array<{label: string; href: string; method: string}> {
  return items.flatMap((item) => {
    if (item.type === 'category') return linksOf(item.items);
    if (item.type !== 'link') return [];
    const method = (item.customProps as {method?: string} | undefined)?.method;
    return method ? [{label: item.label, href: item.href, method}] : [];
  });
}

/** The API section of the sidebar that holds the current endpoint, by group. */
function useEndpointGroups(pathname: string): NavGroup[] {
  const sidebar = useDocsSidebar();
  return useMemo(() => {
    const sections = (sidebar?.items ?? []).filter((item) => item.type === 'category');
    const section = sections.find((s) => s.type === 'category' && linksOf(s.items).some((l) => l.href === pathname));
    if (!section || section.type !== 'category') return [];
    return section.items
      .filter((item) => item.type === 'category')
      .map((group) => ({
        title: `${section.label} ⁄ ${group.label}`,
        section: section.label,
        group: group.label,
        items: group.type === 'category' ? linksOf(group.items) : [],
      }));
  }, [sidebar, pathname]);
}

export function EndpointList({pathname}: {pathname: string}) {
  const groups = useEndpointGroups(pathname);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block: 'center'});
  }, []);
  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({...g, items: g.items.filter((i) => !q || `${i.method} ${i.label} ${g.title}`.toLowerCase().includes(q))}))
    .filter((g) => g.items.length);
  return (
    <aside className="api-explorer__nav">
      <div className="api-explorer__search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search for endpoints..."
          aria-label="Search for endpoints"
          value={query}
          // Fern focused the endpoint search when the explorer opened.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="api-explorer__list" ref={listRef}>
        {filtered.map((group) => (
          <div key={group.title} className="api-explorer__group">
            <div className="api-explorer__group-title" title={group.title}>
              <span>{group.section}</span>
              <span className="api-explorer__group-sep" aria-hidden="true">
                ⁄
              </span>
              <span>{group.group}</span>
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                to={`${item.href}?explorer=true`}
                className={clsx('api-explorer__endpoint', item.href === pathname && 'api-explorer__endpoint--active')}
                aria-current={item.href === pathname ? 'page' : undefined}>
                <MethodBadge method={item.method} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
        {!filtered.length && <p className="api-explorer__empty">No endpoints match “{query}”.</p>}
      </div>
    </aside>
  );
}

/* ---------- Explorer ---------- */

function UrlBar({endpoint, state, req, onSend, onClose}: {endpoint: Endpoint; state: FormState; req: BuiltRequest; onSend: () => void; onClose: () => void}) {
  const [copied, copy] = useCopy();
  const parts = endpoint.path.split(/(\{[^}]+\})/g).filter(Boolean);
  return (
    <div className="api-explorer__bar">
      <div className="api-explorer__url">
        <MethodBadge method={endpoint.method} />
        <span className="api-explorer__address">
          <span className="api-explorer__server">{endpoint.server}</span>
          {parts.map((part, i) => {
            const param = /^\{(.+)\}$/.exec(part)?.[1];
            return param ? (
              <span key={i} className="api-explorer__param">
                {String(state.path[param] ?? '') || `:${param}`}
              </span>
            ) : (
              <span key={i}>{part}</span>
            );
          })}
          {req.query.map(([name, value], i) => (
            <span key={`${name}-${i}`}>
              {i === 0 ? '?' : '&'}
              {name}=<span className="api-explorer__param">{value}</span>
            </span>
          ))}
        </span>
        <button type="button" className="api-explorer__icon-button api-explorer__url-copy" aria-label="Copy URL" onClick={() => copy(fullUrl(req))}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <button type="button" className="api-explorer__send" onClick={onSend}>
        Send request <SendIcon />
      </button>
      <button type="button" className="api-explorer__close" aria-label="Close API explorer" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}

/** Closing the explorer (button or Escape) drops `?explorer=true`. */
export function useExplorerClose(): () => void {
  const history = useHistory();
  const {pathname} = useLocation();
  const close = () => history.push(pathname);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('api-explorer-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('api-explorer-open');
      window.removeEventListener('keydown', onKey);
    };
  });
  return close;
}

export default function ApiExplorer({endpoint}: {endpoint: Endpoint}): React.JSX.Element {
  const {pathname} = useLocation();
  const [state, setState] = useState<FormState>(() => initialState(endpoint));
  const [formKey, setFormKey] = useState(0);
  const [auth, setAuth] = useState('');
  const [authLoaded, setAuthLoaded] = useState(false);
  const [result, setResult] = useState<Result>({state: 'idle'});
  const [expanded, setExpanded] = useState(false);
  const req = buildRequest(endpoint, state, auth);
  const shownReq = auth ? buildRequest(endpoint, state, maskSecret(auth)) : req;

  // Like Fern, the credential lasts as long as the tab (sessionStorage), not
  // across browser restarts; drop the copy earlier builds kept for good.
  useEffect(() => {
    try {
      window.localStorage.removeItem(AUTH_KEY);
      setAuth(window.sessionStorage.getItem(AUTH_KEY) ?? '');
    } catch {
      /* storage unavailable */
    }
    setAuthLoaded(true);
  }, []);
  const saveAuth = (value: string) => {
    setAuth(value);
    try {
      window.sessionStorage.setItem(AUTH_KEY, value);
    } catch {
      /* storage unavailable */
    }
  };

  const close = useExplorerClose();

  const send = async () => {
    setResult({state: 'loading'});
    const started = performance.now();
    try {
      const response = await fetch(fullUrl(req), {
        method: req.method,
        headers: Object.fromEntries(req.headers.filter(([, v]) => v !== '')),
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      });
      const text = await response.text();
      let body = text;
      let json = false;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
        json = true;
      } catch {
        /* not JSON */
      }
      setResult({state: 'done', status: response.status, statusText: response.statusText, ms: Math.round(performance.now() - started), body, json});
    } catch (error) {
      setResult({
        state: 'failed',
        message: `The request could not be sent from your browser (${error instanceof Error ? error.message : String(error)}). The API may not allow requests from this page (CORS), or the network is unavailable. Copy the request as cURL to run it locally.`,
      });
    }
  };

  const reset = (next: FormState) => {
    setState(next);
    setFormKey((k) => k + 1);
  };
  const params: Array<[string, keyof FormState, Property[] | undefined]> = [
    ['Path parameters', 'path', endpoint.pathParams],
    ['Query parameters', 'query', endpoint.queryParams],
    ['Headers', 'headers', endpoint.headerParams],
  ];
  const body = endpoint.requestBody?.shape;

  return (
    <div className="api-explorer" role="dialog" aria-modal="true" aria-label={`API explorer: ${endpoint.title}`}>
      <EndpointList pathname={pathname} />
      <div className="api-explorer__main">
        <UrlBar endpoint={endpoint} state={state} req={req} onSend={send} onClose={close} />
        <div className="api-explorer__content">
          <div className="api-explorer__form" key={formKey}>
            {endpoint.auth && authLoaded && <AuthCard name={endpoint.auth.name} value={auth} onChange={saveAuth} />}
            {params.map(([title, key, props]) =>
              props && props.length ? (
                <FormSection key={key} title={title}>
                  <ObjectFields
                    properties={props}
                    value={state[key] as Values}
                    onChange={(v) => setState((s) => ({...s, [key]: v}))}
                  />
                </FormSection>
              ) : null,
            )}
            {body && (
              <FormSection title="Body parameters">
                {body.kind === 'object' && body.properties?.length ? (
                  <ObjectFields
                    properties={body.properties}
                    value={(state.body && typeof state.body === 'object' ? state.body : {}) as Values}
                    onChange={(v) => setState((s) => ({...s, body: v}))}
                  />
                ) : (
                  <FieldValue shape={body} value={state.body} onChange={(v) => setState((s) => ({...s, body: v}))} />
                )}
              </FormSection>
            )}
            <div className="api-explorer__form-footer">
              <div className="api-explorer__select api-explorer__select--example">
                <select aria-label="Example" defaultValue="1" onChange={() => reset(initialState(endpoint))}>
                  <option value="1">Example 1</option>
                </select>
                <ChevronIcon />
              </div>
              <button type="button" className="api-explorer__link-button" onClick={() => reset(clearedState(endpoint))}>
                Clear form
              </button>
            </div>
          </div>
          <div className="api-explorer__panels">
            <RequestPanel
              req={req}
              shown={shownReq}
              comment={`${endpoint.title} (${endpoint.method} ${endpoint.displayPath})`}
              expanded={expanded}
              onExpand={() => setExpanded(!expanded)}
            />
            {!expanded && <ResponsePanel result={result} onSend={send} />}
          </div>
        </div>
      </div>
    </div>
  );
}
