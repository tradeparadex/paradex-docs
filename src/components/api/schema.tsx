// Schema tables of the API reference: property rows, allowed values and the
// nested "Show N properties" groups, laid out as on Fern.

import React, {useState} from 'react';
import clsx from 'clsx';
import {MinusIcon, PlusIcon, SearchIcon, CloseIcon} from './icons';
import {useCopy} from './panels';
import type {Property, Shape} from './types';

/** Up to this many values are listed inline; more go behind a toggle. */
const ENUM_INLINE_LIMIT = 5;

export function Html({html, className}: {html?: string; className?: string}) {
  if (!html) return null;
  return <div className={clsx('api-markdown', className)} dangerouslySetInnerHTML={{__html: html}} />;
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
  const [open, setOpen] = useState(defaultOpen);
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
  idPrefix = 'prop',
}: Property & {requiredLabel?: boolean; idPrefix?: string}) {
  return (
    <div className="api-prop" id={name ? `${idPrefix}-${name}` : undefined}>
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
      </div>
      <Html html={shape.description} className="api-prop__description" />
      <ShapeDetails shape={shape} />
    </div>
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
  return (
    <section className={clsx('api-section', className)} id={id}>
      <h3 className="api-section__title">
        {title}
        {icon}
      </h3>
      {children}
    </section>
  );
}

/** Body of a request, response or error: description, then its properties. */
export function BodySchema({shape, description}: {shape?: Shape; description?: string}) {
  const nested = shape ? nestedProperties(shape) : undefined;
  return (
    <>
      <Html html={description} className="api-section__description" />
      {shape && shape.kind === 'array' && nested?.length ? <p className="api-section__type">{shape.label}</p> : null}
      {shape && !nested?.length && shape.kind !== 'unknown' && (
        <div className="api-props">
          <PropertyRow name="" required shape={shape} requiredLabel={false} />
        </div>
      )}
      {nested && nested.length > 0 && <Properties properties={nested} />}
    </>
  );
}
