// "Try it" for WebSocket channels: Fern's WebSocket playground, rebuilt. It
// opens at `?explorer=true` over a channel page, connects to the channel URL
// from the browser, sends the message built in the form and logs every
// message both ways.

import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import {useLocation} from '@docusaurus/router';
import {CloseIcon, EndpointList, FormSection, ObjectFields, emptyValue, useExplorerClose, type Values} from './ApiExplorer';
import {ArrowDownIcon, ArrowUpIcon, BroadcastIcon, ChevronDownIcon} from './icons';
import {CopyButton} from './panels';
import type {Endpoint, Property, Shape} from './types';

type Status = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
type LogEntry = {id: number; direction: 'sent' | 'received' | 'info'; data: string; time: Date};

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Not connected',
  connecting: 'Connecting...',
  open: 'Connected',
  closed: 'Disconnected',
  error: 'Not connected',
};

/** Fern started the playground form empty: no enum chosen, blank strings, 0. */
function blankValue(shape: Shape): unknown {
  if (shape.kind === 'enum') return '';
  if (shape.kind === 'object') {
    return Object.fromEntries((shape.properties ?? []).filter((p) => p.required).map((p) => [p.name, blankValue(p.shape)]));
  }
  return emptyValue(shape);
}

const pretty = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

function LogRow({entry}: {entry: LogEntry}) {
  const [open, setOpen] = useState(false);
  const body = pretty(entry.data);
  if (entry.direction === 'info') {
    return <div className="api-ws-log__info">{entry.data}</div>;
  }
  const sent = entry.direction === 'sent';
  return (
    <div className={clsx('api-message', sent ? 'api-message--publish' : 'api-message--subscribe', open && 'api-message--open')}>
      <div className="api-message__header">
        <button type="button" className="api-message__row" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="api-message__icon">{sent ? <ArrowUpIcon /> : <ArrowDownIcon />}</span>
          <span className="api-message__preview">{body}</span>
          <span className="api-message__type">
            <span className="api-message__direction">{entry.time.toLocaleTimeString()}</span>
          </span>
          <ChevronDownIcon className="api-message__chevron" />
        </button>
        <CopyButton text={body} className="api-message__copy" />
      </div>
      {open && (
        <div className="api-message__body">
          <CodeBlock language="text" showLineNumbers className="api-message__code">
            {body}
          </CodeBlock>
        </div>
      )}
    </div>
  );
}

export default function WebSocketExplorer({endpoint}: {endpoint: Endpoint}): React.JSX.Element {
  const {pathname} = useLocation();
  const close = useExplorerClose();
  const pathParams = endpoint.pathParams ?? [];
  const send = endpoint.send;
  const [params, setParams] = useState<Values>(() => Object.fromEntries(pathParams.map((p) => [p.name, ''])));
  const [message, setMessage] = useState<unknown>(() => (send ? blankValue(send.shape) : undefined));
  const [status, setStatus] = useState<Status>('idle');
  const [log, setLog] = useState<LogEntry[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const nextId = useRef(0);
  const logEnd = useRef<HTMLDivElement>(null);

  const path = endpoint.path.replace(/\{([^}]+)\}/g, (_, name: string) => String(params[name] ?? '') || `{${name}}`).replace(/[[\]]/g, '');
  const url = endpoint.server + path;
  const parts = endpoint.path.replace(/[[\]]/g, '').split(/(\{[^}]+\})/g).filter(Boolean);

  const push = (direction: LogEntry['direction'], data: string) =>
    setLog((entries) => [...entries, {id: nextId.current++, direction, data, time: new Date()}]);

  useEffect(() => () => socket.current?.close(), []);
  useEffect(() => {
    logEnd.current?.scrollIntoView({block: 'nearest'});
  }, [log.length]);

  const connect = () => {
    if (socket.current && (status === 'open' || status === 'connecting')) {
      socket.current.close();
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      setStatus('error');
      push('info', `Could not connect to ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    socket.current = ws;
    setStatus('connecting');
    ws.onopen = () => {
      setStatus('open');
      push('info', `Connected to ${url}`);
    };
    ws.onmessage = (event) => push('received', typeof event.data === 'string' ? event.data : String(event.data));
    ws.onerror = () => {
      setStatus('error');
      push('info', `Connection error (${url}).`);
    };
    ws.onclose = (event) => {
      if (socket.current === ws) socket.current = null;
      setStatus((s) => (s === 'error' ? s : 'closed'));
      push('info', `Disconnected${event.code ? ` (code ${event.code}${event.reason ? `: ${event.reason}` : ''})` : ''}.`);
    };
  };

  const sendMessage = () => {
    const data = JSON.stringify(message ?? {});
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      push('info', 'Connect before sending a message.');
      return;
    }
    socket.current.send(data);
    push('sent', data);
  };

  const connected = status === 'open';
  const messageProps: Property[] = send?.shape.kind === 'object' ? (send.shape.properties ?? []) : [];

  return (
    <div className="api-explorer api-explorer--ws" role="dialog" aria-modal="true" aria-label={`WebSocket playground: ${endpoint.title}`}>
      <EndpointList pathname={pathname} />
      <div className="api-explorer__main">
        <div className="api-explorer__bar">
          <div className="api-explorer__url">
            <span className="api-explorer__address api-explorer__address--ws">
              <span className="api-explorer__server">{endpoint.server}</span>
              {parts.map((part, i) => {
                const param = /^\{(.+)\}$/.exec(part)?.[1];
                return param ? (
                  <span key={i} className="api-explorer__param">
                    {String(params[param] ?? '') || `:${param}`}
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                );
              })}
            </span>
            <CopyButton text={url} className="api-explorer__url-copy" />
          </div>
          <button type="button" className={clsx('api-explorer__send', connected && 'api-explorer__send--connected')} onClick={connect}>
            {status === 'open' || status === 'connecting' ? 'Disconnect' : 'Connect'} <BroadcastIcon />
          </button>
          <button type="button" className="api-explorer__close" aria-label="Close API explorer" onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <div className="api-explorer__content">
          <div className="api-explorer__form">
            {pathParams.length > 0 && (
              <FormSection title="Path parameters">
                <ObjectFields properties={pathParams} value={params} onChange={setParams} />
              </FormSection>
            )}
            {send && (
              <section className="api-explorer__section api-ws-send">
                <h5 className="api-ws-send__title">publish</h5>
                <div className="api-explorer__card api-ws-send__card">
                  <div className="api-ws-send__fields">
                    {messageProps.length ? (
                      <ObjectFields
                        properties={messageProps}
                        value={(message && typeof message === 'object' ? message : {}) as Values}
                        onChange={setMessage}
                      />
                    ) : (
                      <p className="api-ws-send__empty">This message has no properties.</p>
                    )}
                  </div>
                  <div className="api-ws-send__footer">
                    <button type="button" className="api-ws-send__button" onClick={sendMessage}>
                      Send message
                    </button>
                  </div>
                </div>
              </section>
            )}
            {!send && <p className="api-ws-send__empty">This channel only sends messages to you: connect to receive them.</p>}
          </div>
          <div className="api-explorer__panels">
            <div className="api-explorer__panel api-ws-log">
              <div className="api-explorer__panel-header">
                <span className="api-explorer__panel-title">Messages</span>
                <span className={clsx('api-ws-status', `api-ws-status--${status}`)}>
                  <span className="api-ws-status__dot" />
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <div className="api-explorer__panel-body api-ws-log__body">
                {log.length === 0 ? (
                  <div className="api-ws-log__empty">No messages...</div>
                ) : (
                  <div className="api-messages">
                    {log.map((entry) => (
                      <LogRow key={entry.id} entry={entry} />
                    ))}
                    <div ref={logEnd} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
