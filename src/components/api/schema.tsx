// Schema tables of the API reference: property rows, allowed values and the
// nested "Show N properties" groups, laid out as on Fern.

import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import {useHistory, useLocation} from '@docusaurus/router';
import {CheckIcon, LinkIcon, MinusIcon, PlusIcon, SearchIcon, CloseIcon} from './icons';
import {useCopy} from './panels';
import type {Property, Shape} from './types';

// Anchor ids as on Fern: the path of parts down to a section or property,
// joined with dots ("request.body.market", "response.error").
const AnchorParts = createContext<string[]>([]);

export function AnchorPart({part, children}: {part: string; children: React.ReactNode}) {
  const parts = useContext(AnchorParts);
  return <AnchorParts.Provider value={[...parts, part.replaceAll(' ', '-')]}>{children}</AnchorParts.Provider>;
}

// The id the URL hash points at; a new object on every navigation to it.
// Fern faded the tint in, except for the hash the page was loaded with.
type Target = {id: string; fadeIn: boolean};
const AnchorTarget = createContext<Target | null>(null);

/** True when the target is the row at `parts` or anything inside it. */
function targets(target: Target | null, parts: string[]): boolean {
  const id = parts.join('.');
  return !!target && !!id && (target.id === id || target.id.startsWith(`${id}.`));
}

function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

/**
 * Follows the URL hash as Fern did: the groups down to the target open (see
 * Nesting), then the target scrolls under the header and a property row is
 * tinted for a moment. Docusaurus moves to an anchor with history.push (no
 * hashchange event), so this follows the router location. The hash applies
 * after hydration: the server rendered every group closed.
 */
export function AnchorTargets({children}: {children: React.ReactNode}) {
  const {hash, key} = useLocation();
  const [target, setTarget] = useState<Target | null>(null);
  const loaded = useRef(false);
  useEffect(() => {
    setTarget(hash.length > 1 ? {id: decodeHash(hash), fadeIn: loaded.current} : null);
    loaded.current = true;
  }, [hash, key]);
  useEffect(() => {
    const el = target && document.getElementById(target.id);
    if (!el?.closest('.api-endpoint')) return;
    el.scrollIntoView({block: 'start'});
    if (el.classList.contains('api-prop')) {
      el.classList.remove('api-prop--flash', 'api-prop--flash-in');
      void el.offsetWidth; // restart the animation
      el.classList.add('api-prop--flash');
      if (target.fadeIn) el.classList.add('api-prop--flash-in');
      // Leave nothing behind once it has faded.
      el.addEventListener('animationend', function done(e) {
        if (e.target !== el) return;
        el.classList.remove('api-prop--flash', 'api-prop--flash-in');
        el.removeEventListener('animationend', done);
      });
    }
  }, [target]);
  return <AnchorTarget.Provider value={target}>{children}</AnchorTarget.Provider>;
}

/** Fern's link button beside a heading or property name: links to it and copies the URL. */
function AnchorLink({id}: {id: string}) {
  const history = useHistory();
  const [copied, copy] = useCopy();
  return (
    <a
      href={`#${id}`}
      className={clsx('api-anchor', copied && 'api-anchor--copied')}
      // Out of the tab order, as on Fern: a page has hundreds of them.
      tabIndex={-1}
      aria-label={`Direct link to ${id}`}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        copy(`${window.location.origin}${window.location.pathname}#${id}`);
        // Fern replaced the history entry rather than adding one.
        history.replace({pathname: history.location.pathname, search: history.location.search, hash: `#${id}`});
      }}>
      {copied ? <CheckIcon /> : <LinkIcon />}
    </a>
  );
}

/** Up to this many values are listed inline; more go behind a toggle. */
const ENUM_INLINE_LIMIT = 5;

type HtmlPart = {html: string} | {code: string; language?: string};

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

const decodeEntities = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');

/** The description's top-level code fences (`<pre><code>`), split from the HTML around them. */
function splitCodeBlocks(html: string): HtmlPart[] {
  const parts: HtmlPart[] = [];
  const tags = /<(\/?)([a-zA-Z][\w-]*)[^>]*>/g;
  let depth = 0;
  let start = 0;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    const [text, closing, name] = tag;
    if (VOID_TAGS.has(name.toLowerCase()) || text.endsWith('/>')) continue;
    if (closing) {
      depth -= 1;
      continue;
    }
    const end = depth === 0 && name === 'pre' ? html.indexOf('</pre>', tags.lastIndex) : -1;
    const fence = end === -1 ? null : /^<code(?: class="language-([^"]+)")?>([\s\S]*)<\/code>$/.exec(html.slice(tags.lastIndex, end));
    if (fence) {
      if (html.slice(start, tag.index).trim()) parts.push({html: html.slice(start, tag.index)});
      parts.push({code: decodeEntities(fence[2]).replace(/\n$/, ''), language: fence[1]});
      start = tags.lastIndex = end + '</pre>'.length;
    } else {
      depth += 1;
    }
  }
  if (html.slice(start).trim()) parts.push({html: html.slice(start)});
  return parts;
}

/**
 * Description HTML from plugins/api-reference. Code fences render as the
 * site's code blocks (highlighting, line numbers, copy), as on Fern.
 */
export function Html({html, className}: {html?: string; className?: string}) {
  if (!html) return null;
  const parts = html.includes('<pre') ? splitCodeBlocks(html) : [];
  if (!parts.some((part) => 'code' in part)) {
    return <div className={clsx('api-markdown', className)} dangerouslySetInnerHTML={{__html: html}} />;
  }
  return (
    <div className={clsx('api-markdown', className)}>
      {parts.map((part, i) =>
        'code' in part ? (
          <CodeBlock key={i} language={part.language}>
            {part.code}
          </CodeBlock>
        ) : (
          <div key={i} className="api-markdown__html" dangerouslySetInnerHTML={{__html: part.html}} />
        ),
      )}
    </div>
  );
}

export function nestedProperties(shape: Shape): Property[] | undefined {
  if (shape.kind === 'object') return shape.properties;
  if (shape.kind === 'array' && shape.items?.kind === 'object') return shape.items.properties;
  if (shape.kind === 'map' && shape.mapValues?.kind === 'object') return shape.mapValues.properties;
  return undefined;
}

/** An allowed value: click to copy it. */
function EnumChip({value, large = false}: {value: string; large?: boolean}) {
  const [copied, copy] = useCopy();
  return (
    <button
      type="button"
      className={clsx('api-chip', large && 'api-chip--large', copied && 'api-chip--copied')}
      onClick={() => copy(value)}>
      {value === '' ? '""' : value}
      {copied && (
        <span className="api-tooltip" role="status">
          Copied!
        </span>
      )}
    </button>
  );
}

/** "Show N …" / "Hide N …" toggle with the indented rail Fern used. */
function Nesting({label, children, defaultOpen = false}: {label: (open: boolean) => string; children: React.ReactNode; defaultOpen?: boolean}) {
  const target = useContext(AnchorTarget);
  const parts = useContext(AnchorParts);
  const [open, setOpen] = useState(() => defaultOpen || targets(target, parts));
  // A deep link to this group's row or into it opens the group, in the same
  // render, so the groups below open too before the target is scrolled to.
  const [seen, setSeen] = useState(target);
  if (target !== seen) {
    setSeen(target);
    if (targets(target, parts)) setOpen(true);
  }
  return (
    <div className={clsx('api-nesting', open && 'api-nesting--open')}>
      <button type="button" className="api-nesting__trigger" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="api-nesting__toggle" aria-hidden="true">
          {open ? <MinusIcon /> : <PlusIcon />}
        </span>
        {label(open)}
      </button>
      {open && <div className="api-nesting__body">{children}</div>}
    </div>
  );
}

function EnumValues({values}: {values: string[]}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  if (values.length <= ENUM_INLINE_LIMIT) {
    return (
      <div className="api-enum">
        <span className="api-enum__label">Allowed values:</span>
        <span className="api-enum__values">
          {values.map((v) => (
            <EnumChip key={v} value={v} />
          ))}
        </span>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="api-nesting">
        <button type="button" className="api-nesting__trigger" aria-expanded={false} onClick={() => setOpen(true)}>
          <span className="api-nesting__toggle" aria-hidden="true">
            <PlusIcon />
          </span>
          Show {values.length} enum values
        </button>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = values.filter((v) => !q || v.toLowerCase().includes(q));
  return (
    <div className="api-nesting api-nesting--open api-nesting--enum">
      <div className="api-enum-search">
        <SearchIcon className="api-enum-search__icon" />
        <input
          type="search"
          placeholder="Search..."
          aria-label="Search enum values"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="api-enum-search__clear"
          aria-label={query ? 'Clear' : 'Hide enum values'}
          onClick={() => (query ? setQuery('') : setOpen(false))}>
          <CloseIcon />
        </button>
      </div>
      <div className="api-nesting__body api-nesting__body--enum">
        <div className="api-enum__list">
          {shown.map((v) => (
            <EnumChip key={v} value={v} large />
          ))}
          {!shown.length && <span className="api-enum__empty">No values match “{query}”</span>}
        </div>
      </div>
    </div>
  );
}

function ShapeDetails({shape}: {shape: Shape}) {
  const enumValues =
    shape.kind === 'enum' ? shape.values : shape.kind === 'array' && shape.items?.kind === 'enum' ? shape.items.values : undefined;
  const nested = nestedProperties(shape);
  return (
    <>
      {enumValues && enumValues.length > 0 && <EnumValues values={enumValues} />}
      {nested && nested.length > 0 && (
        <Nesting label={(open) => `${open ? 'Hide' : 'Show'} ${nested.length} ${nested.length === 1 ? 'property' : 'properties'}`}>
          <Properties properties={nested} nested />
        </Nesting>
      )}
      {shape.kind === 'union' && shape.variants && (
        <Nesting label={(open) => `${open ? 'Hide' : 'Show'} ${shape.variants!.length} variants`}>
          <div className="api-props api-props--nested">
            {shape.variants.map((variant, i) => (
              <div key={i} className="api-prop api-variant">
                <div className="api-prop__header">
                  <span className="api-prop__meta">
                    <span className="api-prop__type">{variant.name ?? variant.label}</span>
                  </span>
                </div>
                <Html html={variant.description} className="api-prop__description" />
                <ShapeDetails shape={variant} />
              </div>
            ))}
          </div>
        </Nesting>
      )}
    </>
  );
}

export function PropertyRow({
  name,
  required,
  shape,
  requiredLabel = true,
}: Property & {requiredLabel?: boolean}) {
  const parent = useContext(AnchorParts);
  const parts = name ? [...parent, name.replaceAll(' ', '-')] : parent;
  const id = name ? parts.join('.') : undefined;
  return (
    <AnchorParts.Provider value={parts}>
      <div className="api-prop" id={id}>
        <div className="api-prop__header">
          {name && <span className="api-prop__name">{name}</span>}
          <span className="api-prop__meta">
            <span className="api-prop__type">{shape.label}</span>
            {requiredLabel &&
              (required ? <span className="api-prop__required">Required</span> : <span className="api-prop__optional">Optional</span>)}
            {shape.deprecated && <span className="api-prop__deprecated">Deprecated</span>}
            {shape.constraints?.map((c) => (
              <code key={c} className="api-prop__constraint">
                {c}
              </code>
            ))}
            {shape.default !== undefined && (
              <span className="api-prop__default">
                Defaults to <code>{String(shape.default)}</code>
              </span>
            )}
          </span>
          {id && <AnchorLink id={id} />}
        </div>
        <Html html={shape.description} className="api-prop__description" />
        <ShapeDetails shape={shape} />
      </div>
    </AnchorParts.Provider>
  );
}

export function Properties({properties, nested = false}: {properties: Property[]; nested?: boolean}) {
  return (
    <div className={clsx('api-props', nested && 'api-props--nested')}>
      {properties.map((p) => (
        <PropertyRow key={p.name} {...p} />
      ))}
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
  className,
  id,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const parts = useContext(AnchorParts);
  const anchor = id ?? (parts.length ? parts.join('.') : undefined);
  return (
    <section className={clsx('api-section', className)} id={anchor}>
      <h3 className="api-section__title">
        {title}
        {icon}
        {anchor && <AnchorLink id={anchor} />}
      </h3>
      {children}
    </section>
  );
}

/**
 * Body of a request, response or error: description, then its properties.
 * As on Fern, a response that is not an object (a string, a map) shows its
 * description only.
 */
export function BodySchema({shape, description, response = false}: {shape?: Shape; description?: string; response?: boolean}) {
  const nested = shape ? nestedProperties(shape) : undefined;
  return (
    <>
      <Html html={description} className="api-section__description" />
      {shape && !nested?.length && shape.kind !== 'unknown' && !response && (
        <div className="api-props">
          <PropertyRow name="" required shape={shape} requiredLabel={false} />
        </div>
      )}
      {nested && nested.length > 0 && <Properties properties={nested} />}
    </>
  );
}
