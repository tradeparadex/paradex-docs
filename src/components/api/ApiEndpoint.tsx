// Renders a REST endpoint or WebSocket channel page from the JSON written by
// plugins/api-reference. Layout follows Fern's API reference: description and
// schemas on the left, code samples and response examples on the right.

import React, {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import {useHistory, useLocation} from '@docusaurus/router';
import ApiExplorer from './ApiExplorer';
import WebSocketExplorer from './WebSocketExplorer';
import MethodBadge from './MethodBadge';
import {ArrowDownIcon, ArrowUpIcon, ArrowUpRightIcon, ChevronDownIcon, CloseIcon, PlayIcon, WifiIcon} from './icons';
import {CodePanel, CopyButton, LanguageMenu, StatusBadge, StatusSelect, useLanguage, useOverflow, type StatusOption} from './panels';
import {AnchorLink, AnchorPart, AnchorTargets, BodySchema, Html, PropertyRow, Properties, Section} from './schema';
import type {Endpoint, Property} from './types';

export {MethodBadge, PropertyRow, Properties};

const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

/** Fern's URL line: server in grey, path dimmer, path parameters highlighted. */
function Address({endpoint, server = endpoint.server}: {endpoint: Endpoint; server?: string}) {
  return (
    <span className="api-address">
      <span className="api-address__server">{server}</span>
      <span className="api-address__path">
        {endpoint.displayPath.split(/(:[A-Za-z_][\w-]*)/g).map((part, i) =>
          i % 2 ? (
            <span key={i} className="api-address__param">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
    </span>
  );
}

function TryItButton({onClick}: {onClick: () => void}) {
  return (
    <button type="button" className="api-try-it" aria-description="Opens the API Explorer" onClick={onClick}>
      <PlayIcon />
      Try it
    </button>
  );
}

/* ---------- REST panels ---------- */

export function CodeSamplePanel({
  endpoint,
  onTryIt,
  linked = false,
}: {
  endpoint: Endpoint;
  onTryIt?: () => void;
  /** Outside the endpoint's page: link to it, and "Try it" opens its explorer in a new tab (as on Fern). */
  linked?: boolean;
}) {
  const samples = endpoint.samples ?? [];
  const [sample, choose] = useLanguage(samples);
  if (!sample) return null;
  return (
    <CodePanel
      className="api-panel--request"
      header={
        <>
          <MethodBadge method={endpoint.method} />
          <span className="api-panel__path">
            <Address endpoint={endpoint} server={endpoint.serverPath ?? ''} />
          </span>
        </>
      }
      controls={
        <>
          <LanguageMenu samples={samples} value={sample} onChange={choose} />
          {linked && (
            <Link to={endpoint.url} className="api-icon-button api-panel__link" aria-label={`${endpoint.title} reference`}>
              <ArrowUpRightIcon />
            </Link>
          )}
        </>
      }
      code={sample.code}
      language={sample.prism}
      // Fern numbered every sample but cURL (which gets a `$` prompt).
      lineNumbers={sample.language !== 'curl'}
      footer={
        onTryIt ? (
          <TryItButton onClick={onTryIt} />
        ) : linked ? (
          <Link to={`${endpoint.url}?explorer=true`} target="_blank" className="api-try-it">
            <PlayIcon />
            Try it
          </Link>
        ) : undefined
      }
    />
  );
}

type Example = StatusOption & {example?: unknown};

function responseOptions(endpoint: Endpoint): Example[] {
  return [
    ...(endpoint.responses ?? []).map((r) => ({status: r.status, label: r.label, example: r.example})),
    ...(endpoint.errors ?? []).map((e) => ({status: e.status, label: e.name, example: e.example, error: true})),
  ];
}

export function ResponsePanel({
  endpoint,
  selected,
  onSelect,
}: {
  endpoint: Endpoint;
  selected?: number;
  onSelect?: (index: number) => void;
}) {
  const [own, setOwn] = useState(0);
  const options = responseOptions(endpoint);
  const index = selected ?? own;
  const select = onSelect ?? setOwn;
  const current = options[index] ?? options[0];
  if (!current) return null;
  const header = <StatusSelect options={options} value={index} onChange={select} />;
  if (current.example === undefined) {
    return (
      <div className={clsx('api-panel api-panel--response', current.error && 'api-panel--error')}>
        <div className="api-panel__header">
          <div className="api-panel__heading">{header}</div>
        </div>
      </div>
    );
  }
  return (
    <CodePanel
      className={clsx('api-panel--response', current.error && 'api-panel--error')}
      header={header}
      code={pretty(current.example)}
      language="json"
    />
  );
}

/** Opens the API explorer while the URL has `?explorer=true` (as on Fern). */
function useExplorer(): [boolean, () => void] {
  const location = useLocation();
  const history = useHistory();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(new URLSearchParams(location.search).get('explorer') === 'true');
  }, [location.search]);
  return [open, () => history.push(`${location.pathname}?explorer=true`)];
}

const PHONE = '(max-width: 767px)';

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True below 768px; false when rendered on the server and while hydrating. */
function usePhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

/* ---------- Errors ---------- */

function ErrorCard({
  error,
  open,
  onToggle,
  last,
  first,
}: {
  error: NonNullable<Endpoint['errors']>[number];
  open: boolean;
  onToggle: (open: boolean) => void;
  first: boolean;
  last: boolean;
}) {
  return (
    <div
      className={clsx('api-error', open && 'api-error--open', first && 'api-error--first', last && 'api-error--last')}
      onClick={open ? undefined : () => onToggle(true)}>
      <div className="api-error__header">
        <button type="button" className="api-error__toggle" aria-expanded={open} onClick={(e) => {
          e.stopPropagation();
          onToggle(!open);
        }}>
          <StatusBadge status={error.status} error small />
          <span className="api-error__name">{error.name}</span>
        </button>
        {open && (
          <button
            type="button"
            className="api-error__close"
            aria-label="Collapse error"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(false);
            }}>
            <CloseIcon />
          </button>
        )}
      </div>
      {open && (
        <div className="api-error__body">
          <BodySchema shape={error.shape} description={error.description} />
        </div>
      )}
    </div>
  );
}

/* ---------- WebSocket panels ---------- */

function MessageRow({direction, example}: {direction: string; example: unknown}) {
  const [open, setOpen] = useState(false);
  const up = direction === 'publish';
  const json = pretty(example);
  return (
    <div className={clsx('api-message', `api-message--${direction}`, open && 'api-message--open')}>
      <div className="api-message__header">
        <button type="button" className="api-message__row" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="api-message__icon">{up ? <ArrowUpIcon /> : <ArrowDownIcon />}</span>
          <span className="api-message__preview">{json}</span>
          <span className="api-message__type">
            <span className="api-message__direction">{direction}</span>
          </span>
          <ChevronDownIcon className="api-message__chevron" />
        </button>
        <CopyButton text={json} className="api-message__copy" />
      </div>
      {open && (
        <div className="api-message__body">
          <CodeBlock language="text" showLineNumbers className="api-message__code">
            {json}
          </CodeBlock>
        </div>
      )}
    </div>
  );
}

function WebSocketPanels({endpoint, onTryIt}: {endpoint: Endpoint; onTryIt: () => void}) {
  return (
    <>
      <div className="api-panel api-panel--handshake">
        <div className="api-panel__header">
          <span className="api-panel__title">Handshake</span>
        </div>
        <div className="api-panel__body api-panel__body--table">
          <table className="api-handshake">
            <tbody>
              <tr>
                <td>URL</td>
                <td>{endpoint.handshakeUrl}</td>
              </tr>
              <tr>
                <td>Method</td>
                <td>GET</td>
              </tr>
              <tr>
                <td>Status</td>
                <td>101 Switching Protocols</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="api-panel__footer">
          <TryItButton onClick={onTryIt} />
        </div>
      </div>
      {endpoint.messages && endpoint.messages.length > 0 && (
        <div className="api-panel api-panel--messages">
          <div className="api-panel__header">
            <span className="api-panel__title">Messages</span>
          </div>
          <div className="api-panel__body api-messages">
            {endpoint.messages.map((message, i) => (
              <MessageRow key={i} direction={message.direction} example={message.example} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function HandshakeCard({endpoint, onTryIt}: {endpoint: Endpoint; onTryIt: () => void}) {
  const url = endpoint.server + endpoint.displayPath;
  const params = endpoint.pathParams ?? [];
  // Like Fern, fade the end of the address only when it is cut off.
  const pill = useRef<HTMLDivElement>(null);
  const cutOff = useOverflow(pill, [url], 'x');
  return (
    <section className="api-handshake-card" id="handshake">
      <div className="api-handshake-card__head">
        <h2 className="api-handshake-card__title">
          <span className="api-handshake-card__label">
            Handshake
            <span className="api-handshake-card__icon">
              <WifiIcon />
            </span>
            <AnchorLink id="handshake" heading />
          </span>
          <span className="api-handshake-card__try">
            <TryItButton onClick={onTryIt} />
          </span>
        </h2>
        <div className="api-url-pill">
          <div ref={pill} className={clsx('api-url-pill__scroll', cutOff && 'api-url-pill__scroll--cut')}>
            <MethodBadge method="WSS" />
            <Address endpoint={endpoint} />
          </div>
          <CopyButton text={url} className="api-url-pill__copy" />
        </div>
      </div>
      <div className="api-handshake-card__body">
        {params.length > 0 && (
          <AnchorPart part="request">
            <AnchorPart part="path">
              <Section title="Path parameters">
                <Properties properties={params} />
              </Section>
            </AnchorPart>
          </AnchorPart>
        )}
      </div>
    </section>
  );
}

function DirectionIcon({direction}: {direction: 'publish' | 'subscribe'}) {
  return (
    <span className={clsx('api-direction', `api-direction--${direction}`)}>
      {direction === 'publish' ? <ArrowUpIcon /> : <ArrowDownIcon />}
    </span>
  );
}

/* ---------- Page ---------- */

export default function ApiEndpoint({endpoint}: {endpoint: Endpoint}): React.JSX.Element {
  const isWs = endpoint.kind === 'websocket';
  const [exploring, openExplorer] = useExplorer();
  // Response shown on the right: index into success responses then errors.
  const [selected, setSelected] = useState(0);
  const successCount = endpoint.responses?.length ?? 0;
  const openError = selected >= successCount ? selected - successCount : -1;
  const toggleError = useCallback((i: number, open: boolean) => setSelected(open ? successCount + i : 0), [successCount]);
  // Title, Fern's anchor part, properties.
  const params: Array<[string, string, Property[] | undefined]> = [
    ['Path parameters', 'path', endpoint.pathParams],
    ['Query parameters', 'query', endpoint.queryParams],
    ['Headers', 'header', endpoint.headerParams],
  ];
  const phone = usePhone();
  const examples = (
    <aside key="examples" className="api-endpoint__aside">
      <div className="api-endpoint__sticky">
        {isWs ? (
          <WebSocketPanels endpoint={endpoint} onTryIt={openExplorer} />
        ) : (
          <>
            <CodeSamplePanel endpoint={endpoint} onTryIt={openExplorer} />
            <ResponsePanel endpoint={endpoint} selected={selected} onSelect={setSelected} />
          </>
        )}
      </div>
    </aside>
  );
  const description = <Html key="description" html={endpoint.descriptionHtml} className="api-endpoint__description" />;
  return (
    <div className={clsx('api-endpoint', isWs && 'api-endpoint--ws')}>
      <div className="api-endpoint__url">
        <MethodBadge method={endpoint.method} />
        <span className="api-endpoint__address">
          <Address endpoint={endpoint} />
        </span>
      </div>
      {/* Fern's markup has the examples before the description from 768px
          and after it on phones; keyboard and screen-reader users follow that
          order, while grid areas keep the layout. Keys move the examples
          across the breakpoint rather than remount them. */}
      <div className="api-endpoint__grid">
        {phone ? [description, examples] : [examples, description]}
        <div className="api-endpoint__main">
          <AnchorTargets>
            {isWs ? (
              <>
                <HandshakeCard endpoint={endpoint} onTryIt={openExplorer} />
                {endpoint.send && (
                  <AnchorPart part="send">
                    <Section title="Send" icon={<DirectionIcon direction="publish" />}>
                      <div className="api-props">
                        <PropertyRow
                          name="publish"
                          required
                          shape={{...endpoint.send.shape, label: 'object', description: endpoint.send.descriptionHtml || undefined}}
                        />
                      </div>
                    </Section>
                  </AnchorPart>
                )}
                {endpoint.receive && (
                  <AnchorPart part="receive">
                    <Section title="Receive" icon={<DirectionIcon direction="subscribe" />}>
                      <div className="api-props">
                        <PropertyRow
                          name="subscribe"
                          required
                          shape={{...endpoint.receive.shape, label: 'object', description: endpoint.receive.descriptionHtml || undefined}}
                        />
                      </div>
                    </Section>
                  </AnchorPart>
                )}
              </>
            ) : (
              <>
                <AnchorPart part="request">
                  {endpoint.auth && (
                    <AnchorPart part="auth">
                      <Section title="Authentication" className="api-section--auth">
                        <div className="api-props">
                          <PropertyRow
                            name={endpoint.auth.name}
                            required
                            requiredLabel={false}
                            shape={{kind: 'primitive', label: endpoint.auth.label, description: endpoint.auth.descriptionHtml}}
                          />
                        </div>
                      </Section>
                    </AnchorPart>
                  )}
                  {params.map(([title, part, list]) =>
                    list && list.length > 0 ? (
                      <AnchorPart key={title} part={part}>
                        <Section title={title}>
                          <Properties properties={list} />
                        </Section>
                      </AnchorPart>
                    ) : null,
                  )}
                  {endpoint.requestBody && (
                    <Section title="Request">
                      <AnchorPart part="body">
                        <BodySchema shape={endpoint.requestBody.shape} description={endpoint.requestBody.description} />
                      </AnchorPart>
                    </Section>
                  )}
                </AnchorPart>
                <AnchorPart part="response">
                  {endpoint.responses
                    ?.filter((r) => r.shape || r.description)
                    .map((response) => (
                      <Section key={response.status} title="Response">
                        <AnchorPart part="body">
                          <BodySchema shape={response.shape} description={response.description} response />
                        </AnchorPart>
                      </Section>
                    ))}
                  {endpoint.errors && endpoint.errors.length > 0 && (
                    <AnchorPart part="error">
                      <Section title="Errors" className="api-section--errors">
                        <div className="api-errors">
                          {endpoint.errors.map((error, i) => (
                            <ErrorCard
                              key={error.status}
                              error={error}
                              open={openError === i}
                              first={i === 0}
                              last={i === endpoint.errors!.length - 1}
                              onToggle={(open) => toggleError(i, open)}
                            />
                          ))}
                        </div>
                      </Section>
                    </AnchorPart>
                  )}
                </AnchorPart>
              </>
            )}
          </AnchorTargets>
        </div>
      </div>
      {exploring &&
        createPortal(isWs ? <WebSocketExplorer endpoint={endpoint} /> : <ApiExplorer endpoint={endpoint} />, document.body)}
    </div>
  );
}

/** Fern `<EndpointRequestSnippet endpoint="GET /markets" />` */
export function EndpointRequestSnippet({endpoint}: {endpoint: Endpoint | string}) {
  if (!endpoint || typeof endpoint === 'string') return null;
  return (
    <div className="api-snippet">
      <CodeSamplePanel endpoint={endpoint} linked />
    </div>
  );
}

/** Fern `<EndpointResponseSnippet endpoint="GET /markets" />`: the first success example, titled "Response". */
export function EndpointResponseSnippet({endpoint}: {endpoint: Endpoint | string}) {
  if (!endpoint || typeof endpoint === 'string') return null;
  const example = endpoint.responses?.find((r) => r.example !== undefined)?.example;
  if (example === undefined) return null;
  return (
    <div className="api-snippet">
      <CodePanel
        className="api-panel--response"
        header={<span className="api-panel__title">Response</span>}
        code={pretty(example)}
        language="json"
      />
    </div>
  );
}
