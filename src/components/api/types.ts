// Shapes of the JSON files written by plugins/api-reference.

export type Shape = {
  kind: 'primitive' | 'enum' | 'object' | 'array' | 'map' | 'union' | 'circular' | 'unknown';
  label: string;
  name?: string;
  description?: string;
  constraints?: string[];
  default?: unknown;
  deprecated?: boolean;
  values?: string[];
  properties?: Property[];
  items?: Shape;
  mapValues?: Shape;
  variants?: Shape[];
};

export type Property = {name: string; required: boolean; shape: Shape};

export type Sample = {language: string; label: string; prism: string; code: string};

export type Response = {status: string; label: string; description?: string; shape?: Shape; example?: unknown};

export type WsOperation = {direction: 'publish' | 'subscribe'; summary?: string; descriptionHtml?: string; shape: Shape; example?: unknown};

export type RequestExample = {
  path: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
};

export type Endpoint = {
  api: string;
  kind?: 'websocket';
  method: string;
  path: string;
  displayPath: string;
  server: string;
  serverPath?: string;
  title: string;
  url: string;
  descriptionHtml?: string;
  auth?: {name: string; label: string; description: string};
  pathParams?: Property[];
  queryParams?: Property[];
  headerParams?: Property[];
  requestBody?: {description?: string; contentType: string; required: boolean; shape: Shape};
  responses?: Response[];
  errors?: Array<{status: string; name: string; description?: string; shape?: Shape}>;
  samples?: Sample[];
  example?: RequestExample;
  handshakeUrl?: string;
  messages?: Array<{direction: string; example: unknown}>;
  send?: WsOperation;
  receive?: WsOperation;
};
