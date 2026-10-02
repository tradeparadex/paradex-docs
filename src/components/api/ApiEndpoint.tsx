// Renders a REST endpoint or WebSocket channel page from the JSON written by
// plugins/api-reference. Layout follows Fern's API reference: description and
// schemas on the left, code samples and response examples on the right.

import React, {useEffect, useState} from 'react';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import type {Endpoint, Property, Response, Sample, Shape} from './types';

const ENUM_INLINE_LIMIT = 5;
const LANGUAGE_KEY = 'paradex-docs-api-language';
const LANGUAGE_EVENT = 'paradex-docs-api-language';

function Html({html, className}: {html?: string; className?: string}) {
  if (!html) return null;
  return <div className={clsx('api-markdown', className)} dangerouslySetInnerHTML={{__html: html}} />;
}

export function MethodBadge({method, className}: {method: string; className?: string}) {
  const label = method === 'DELETE' ? 'DEL' : method;
  return <span className={clsx('api-method-badge', `api-method-badge--${method.toLowerCase()}`, className)}>{label}</span>;
}

function nestedProperties(shape: Shape): Property[] | undefined {
  if (shape.kind === 'object') return shape.properties;
  if (shape.kind === 'array' && shape.items?.kind === 'object') return shape.items.properties;
  if (shape.kind === 'map' && shape.mapValues?.kind === 'object') return shape.mapValues.properties;
  return undefined;
}

function EnumValues({values}: {values: string[]}) {
  const chips = (
    <div className="api-enum__values">
      {values.map((v) => (
        <code key={v} className="api-enum__value">
          {v}
        </code>
      ))}
    </div>
  );
  if (values.length <= ENUM_INLINE_LIMIT) {
    return (
      <div className="api-enum api-enum--inline">
        <span className="api-enum__label">Allowed values:</span>
        {chips}
      </div>
    );
  }
  return (
    <details className="api-disclosure">
      <summary>Show {values.length} enum values</summary>
      {chips}
    </details>
  );
}

function ShapeDetails({shape}: {shape: Shape}) {
  const enumValues = shape.kind === 'enum' ? shape.values : shape.kind === 'array' && shape.items?.kind === 'enum' ? shape.items.values : undefined;
  const nested = nestedProperties(shape);
  return (
    <>
      {enumValues && enumValues.length > 0 && <EnumValues values={enumValues} />}
      {nested && nested.length > 0 && (
        <details className="api-disclosure">
          <summary>
            Show {nested.length} {nested.length === 1 ? 'property' : 'properties'}
          </summary>
          <div className="api-disclosure__body">
            <Properties properties={nested} />
          </div>
        </details>
      )}
      {shape.kind === 'union' && shape.variants && (
        <details className="api-disclosure">
          <summary>Show {shape.variants.length} variants</summary>
          <div className="api-disclosure__body">
            {shape.variants.map((variant, i) => (
              <div key={i} className="api-variant">
                <div className="api-prop__header">
                  <span className="api-prop__type">{variant.name ?? variant.label}</span>
                </div>
                <Html html={variant.description} className="api-prop__description" />
                <ShapeDetails shape={variant} />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

export function PropertyRow({name, required, shape, requiredLabel = true}: Property & {requiredLabel?: boolean}) {
  return (
    <div className="api-prop" id={name ? `prop-${name}` : undefined}>
      <div className="api-prop__header">
        {name && <code className="api-prop__name">{name}</code>}
        <span className="api-prop__type">{shape.label}</span>
        {requiredLabel &&
          (required ? (
            <span className="api-prop__required">Required</span>
          ) : (
            <span className="api-prop__optional">Optional</span>
          ))}
        {shape.deprecated && <span className="api-prop__deprecated">Deprecated</span>}
        {shape.constraints?.map((c) => (
          <span key={c} className="api-prop__constraint">
            {c}
          </span>
        ))}
        {shape.default !== undefined && (
          <span className="api-prop__default">
            Defaults to <code>{String(shape.default)}</code>
          </span>
        )}
      </div>
      <Html html={shape.description} className="api-prop__description" />
      <ShapeDetails shape={shape} />
    </div>
  );
}

export function Properties({properties}: {properties: Property[]}) {
  return (
    <div className="api-props">
      {properties.map((p) => (
        <PropertyRow key={p.name} {...p} />
      ))}
    </div>
  );
}

function Section({title, icon, children}: {title: string; icon?: React.ReactNode; children: React.ReactNode}) {
  return (
    <section className="api-section">
      <h3 className="api-section__title">
        {title}
        {icon}
      </h3>
      {children}
    </section>
  );
}

function BodySchema({shape, description}: {shape?: Shape; description?: string}) {
  const nested = shape ? nestedProperties(shape) : undefined;
  return (
    <>
      <Html html={description} className="api-section__description" />
      {shape && !nested?.length && shape.kind !== 'unknown' && (
        <div className="api-props">
          <PropertyRow name="" required shape={shape} requiredLabel={false} />
        </div>
      )}
      {shape && shape.kind === 'array' && nested?.length ? (
        <p className="api-section__type">{shape.label}</p>
      ) : null}
      {nested && nested.length > 0 && <Properties properties={nested} />}
    </>
  );
}

/* ---------- Right-hand panels ---------- */

function useLanguage(samples: Sample[]) {
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

export function CodeSamplePanel({endpoint}: {endpoint: Endpoint}) {
  const samples = endpoint.samples ?? [];
  const [sample, choose] = useLanguage(samples);
  if (!sample) return null;
  return (
    <div className="api-panel">
      <div className="api-panel__header">
        <MethodBadge method={endpoint.method} />
        <span className="api-panel__path">
          <span className="api-panel__base">{endpoint.serverPath}</span>
          {endpoint.displayPath}
        </span>
        {samples.length > 1 ? (
          <select className="api-panel__select" aria-label="Language" value={sample.language} onChange={(e) => choose(e.target.value)}>
            {samples.map((s) => (
              <option key={s.language} value={s.language}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="api-panel__label">{sample.label}</span>
        )}
      </div>
      <CodeBlock language={sample.prism} className="api-panel__code">
        {sample.code}
      </CodeBlock>
    </div>
  );
}

export function ResponsePanel({responses}: {responses: Response[]}) {
  const withExamples = responses;
  const [index, setIndex] = useState(0);
  const response = withExamples[index];
  if (!response) return null;
  return (
    <div className="api-panel">
      <div className="api-panel__header">
        <span className="api-status-badge api-status-badge--success">{response.status}</span>
        {withExamples.length > 1 ? (
          <select className="api-panel__select api-panel__select--left" aria-label="Response" value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {withExamples.map((r, i) => (
              <option key={r.status} value={i}>
                {r.status} {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="api-panel__status-label">{response.label}</span>
        )}
      </div>
      {response.example !== undefined && (
        <CodeBlock language="json" showLineNumbers className="api-panel__code api-panel__code--scroll">
          {JSON.stringify(response.example, null, 2)}
        </CodeBlock>
      )}
    </div>
  );
}

const ArrowIcon = ({up}: {up: boolean}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
  </svg>
);

function MessageRow({direction, example}: {direction: string; example: unknown}) {
  const [open, setOpen] = useState(false);
  const up = direction === 'publish';
  const compact = JSON.stringify(example ?? {});
  return (
    <div className={clsx('api-message', `api-message--${direction}`, open && 'api-message--open')}>
      <button type="button" className="api-message__row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="api-message__icon">
          <ArrowIcon up={up} />
        </span>
        <code className="api-message__preview">{compact}</code>
        <span className="api-message__direction">{direction}</span>
        <svg className="api-message__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <CodeBlock language="json" className="api-message__code">
          {JSON.stringify(example ?? {}, null, 2)}
        </CodeBlock>
      )}
    </div>
  );
}

function WebSocketPanels({endpoint}: {endpoint: Endpoint}) {
  return (
    <>
      <div className="api-panel">
        <div className="api-panel__header">
          <span className="api-panel__title">Handshake</span>
        </div>
        <pre className="api-handshake">
          <span className="api-handshake__key">URL</span>
          <span className="api-handshake__value">{endpoint.handshakeUrl}</span>
          <span className="api-handshake__key">Method</span>
          <span className="api-handshake__value">GET</span>
          <span className="api-handshake__key">Status</span>
          <span className="api-handshake__value">101 Switching Protocols</span>
        </pre>
      </div>
      {endpoint.messages && endpoint.messages.length > 0 && (
        <div className="api-panel">
          <div className="api-panel__header">
            <span className="api-panel__title">Messages</span>
          </div>
          <div className="api-messages">
            {endpoint.messages.map((message, i) => (
              <MessageRow key={i} direction={message.direction} example={message.example} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Page ---------- */

export default function ApiEndpoint({endpoint}: {endpoint: Endpoint}): React.JSX.Element {
  const isWs = endpoint.kind === 'websocket';
  const params: Array<[string, Property[] | undefined]> = [
    ['Path parameters', endpoint.pathParams],
    ['Query parameters', endpoint.queryParams],
    ['Headers', endpoint.headerParams],
  ];
  return (
    <div className={clsx('api-endpoint', isWs && 'api-endpoint--ws')}>
      <div className="api-endpoint__url">
        <MethodBadge method={endpoint.method} />
        <span className="api-endpoint__address">
          <span className="api-endpoint__server">{endpoint.server}</span>
          <span className="api-endpoint__path">{endpoint.displayPath}</span>
        </span>
      </div>
      <div className="api-endpoint__grid">
        <div className="api-endpoint__main">
          <Html html={endpoint.descriptionHtml} className="api-endpoint__description" />
          {isWs ? (
            <>
              <section className="api-section api-handshake-card">
                <h3 className="api-section__title">Handshake</h3>
                <div className="api-endpoint__url api-endpoint__url--inline">
                  <MethodBadge method="WSS" />
                  <span className="api-endpoint__address">
                    <span className="api-endpoint__server">{endpoint.server}</span>
                    <span className="api-endpoint__path">{endpoint.displayPath}</span>
                  </span>
                </div>
                {endpoint.pathParams && endpoint.pathParams.length > 0 && (
                  <>
                    <h4 className="api-section__subtitle">Path parameters</h4>
                    <Properties properties={endpoint.pathParams} />
                  </>
                )}
              </section>
              {endpoint.send && (
                <Section title="Send" icon={<span className="api-direction api-direction--publish"><ArrowIcon up /></span>}>
                  <div className="api-props">
                    <PropertyRow
                      name="publish"
                      required
                      shape={{...endpoint.send.shape, label: 'object', description: endpoint.send.descriptionHtml || undefined}}
                    />
                  </div>
                </Section>
              )}
              {endpoint.receive && (
                <Section title="Receive" icon={<span className="api-direction api-direction--subscribe"><ArrowIcon up={false} /></span>}>
                  <div className="api-props">
                    <PropertyRow
                      name="subscribe"
                      required
                      shape={{...endpoint.receive.shape, label: 'object', description: endpoint.receive.descriptionHtml || undefined}}
                    />
                  </div>
                </Section>
              )}
            </>
          ) : (
            <>
              {endpoint.auth && (
                <Section title="Authentication">
                  <div className="api-props">
                    <PropertyRow
                      name={endpoint.auth.name}
                      required
                      requiredLabel={false}
                      shape={{kind: 'primitive', label: endpoint.auth.label, description: `<p>${endpoint.auth.description}</p>`}}
                    />
                  </div>
                </Section>
              )}
              {params.map(([title, list]) =>
                list && list.length > 0 ? (
                  <Section key={title} title={title}>
                    <Properties properties={list} />
                  </Section>
                ) : null,
              )}
              {endpoint.requestBody && (
                <Section title="Request">
                  <BodySchema shape={endpoint.requestBody.shape} description={endpoint.requestBody.description} />
                </Section>
              )}
              {endpoint.responses?.filter((r) => r.shape || r.description).map((response) => (
                <Section key={response.status} title="Response">
                  <BodySchema shape={response.shape} description={response.description} />
                </Section>
              ))}
              {endpoint.errors && endpoint.errors.length > 0 && (
                <Section title="Errors">
                  <div className="api-errors">
                    {endpoint.errors.map((error) => (
                      <details key={error.status} className="api-error">
                        <summary>
                          <span className="api-status-badge api-status-badge--error">{error.status}</span>
                          <span className="api-error__name">{error.name}</span>
                        </summary>
                        <div className="api-error__body">
                          <BodySchema shape={error.shape} description={error.description} />
                        </div>
                      </details>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
        <aside className="api-endpoint__aside">
          <div className="api-endpoint__sticky">
            {isWs ? (
              <WebSocketPanels endpoint={endpoint} />
            ) : (
              <>
                <CodeSamplePanel endpoint={endpoint} />
                <ResponsePanel responses={endpoint.responses ?? []} />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Fern `<EndpointRequestSnippet endpoint="GET /markets" />` */
export function EndpointRequestSnippet({endpoint}: {endpoint: Endpoint | string}) {
  if (!endpoint || typeof endpoint === 'string') return null;
  return (
    <div className="api-snippet">
      <CodeSamplePanel endpoint={endpoint} />
    </div>
  );
}

/** Fern `<EndpointResponseSnippet endpoint="GET /markets" />` */
export function EndpointResponseSnippet({endpoint}: {endpoint: Endpoint | string}) {
  if (!endpoint || typeof endpoint === 'string') return null;
  return (
    <div className="api-snippet">
      <ResponsePanel responses={endpoint.responses ?? []} />
    </div>
  );
}
