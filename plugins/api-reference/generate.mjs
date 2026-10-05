// Generates one MDX page (plus a JSON data file) per REST endpoint and per
// WebSocket channel, for every `api:` entry in docs/navigation.yml.
//
// Specs live in docs/apis/<api-name>/:
//   openapi/openapi.json (+ openapi/overrides.yml)  -> REST reference
//   asyncapi*.yaml                                   -> WebSocket reference

import fs from 'node:fs';
import path from 'node:path';

import {buildEndpoints, loadOpenApi} from './openapi.mjs';
import {buildChannels, loadAsyncApi} from './asyncapi.mjs';

const yamlString = (value) => JSON.stringify(String(value ?? ''));

export async function generateApiReference({contentDir, pagesDir, generatedDir}) {
  const apisDir = path.join(contentDir, 'apis');
  const pages = [];
  /** `${apiName} ${METHOD} ${path}` -> page */
  const byOperation = new Map();
  /**
   * `${kind} ${relativeUrl}` -> URL of the first page with it. As on Fern,
   * an endpoint listed in two API sections (prod, testnet) has one canonical
   * URL, the first one in navigation order (resolve() runs in that order).
   */
  const canonicalUrls = new Map();

  // Every spec is loaded up front: building the code samples is async, while
  // navigation resolves API sections synchronously.
  const specs = new Map();
  for (const apiName of fs.readdirSync(apisDir).sort()) {
    const dir = path.join(apisDir, apiName);
    if (!fs.statSync(dir).isDirectory()) continue;
    const openapi = path.join(dir, 'openapi', 'openapi.json');
    if (fs.existsSync(openapi)) {
      const document = loadOpenApi(openapi, path.join(dir, 'openapi', 'overrides.yml'));
      specs.set(apiName, {type: 'openapi', document, items: await buildEndpoints(document, {apiName})});
    } else {
      const asyncFile = fs.readdirSync(dir).find((f) => /^asyncapi.*\.ya?ml$/.test(f));
      if (!asyncFile) throw new Error(`No OpenAPI or AsyncAPI spec in ${dir}`);
      const document = loadAsyncApi(path.join(dir, asyncFile));
      specs.set(apiName, {type: 'asyncapi', document, items: buildChannels(document, {apiName})});
    }
  }

  function loadSpec(apiName) {
    const entry = specs.get(apiName);
    if (!entry) throw new Error(`navigation.yml: no API named "${apiName}" in ${apisDir}`);
    return entry;
  }

  function resolve(item, {urlSegments}) {
    const apiName = item['api-name'];
    const {items} = loadSpec(apiName);
    const groups = new Map();
    const redirects = new Map();

    for (const endpoint of items) {
      const segments = [...urlSegments, ...endpoint.groupSlug.split('/'), endpoint.methodSlug];
      const url = '/' + segments.join('/');
      const relPath = path.join('generated', ...segments);
      const mdxFile = path.join(pagesDir, `${relPath}.mdx`);
      const jsonFile = path.join(pagesDir, `${relPath}.json`);
      const docId = relPath.replace(/\\/g, '/');
      const {data} = endpoint;
      // The URL below the API section, e.g. "account/get".
      const relativeUrl = [endpoint.groupSlug, endpoint.methodSlug].join('/');
      const canonicalKey = `${data.kind ?? 'rest'} ${relativeUrl}`;
      if (!canonicalUrls.has(canonicalKey)) canonicalUrls.set(canonicalKey, url);
      const canonicalUrl = canonicalUrls.get(canonicalKey);

      fs.mkdirSync(path.dirname(mdxFile), {recursive: true});
      fs.writeFileSync(jsonFile, JSON.stringify({...data, url}));
      fs.writeFileSync(
        mdxFile,
        [
          '---',
          `title: ${yamlString(data.title)}`,
          `description: ${yamlString(data.metaDescription ?? '')}`,
          `slug: ${yamlString(url)}`,
          'hide_table_of_contents: true',
          'custom_edit_url: null',
          `api_method: ${data.method}`,
          'api_reference: true',
          '---',
          '',
          `import endpoint from './${path.basename(jsonFile)}';`,
          ...(canonicalUrl === url
            ? []
            : [`import CanonicalUrl from '@site/src/components/CanonicalUrl';`, '', `<CanonicalUrl url=${yamlString(canonicalUrl)} />`]),
          '',
          '<ApiEndpoint endpoint={endpoint} />',
          '',
        ].join('\n'),
      );

      const page = {
        file: mdxFile,
        jsonFile,
        url,
        label: data.title,
        title: data.title,
        docId,
        api: apiName,
        group: endpoint.groupTitle,
        relativeUrl,
        canonicalUrl,
        data,
      };
      pages.push(page);
      if (data.kind !== 'websocket') byOperation.set(`${apiName} ${data.method} ${data.path}`, page);

      const groupUrl = '/' + [...urlSegments, ...endpoint.groupSlug.split('/')].join('/');
      if (!groups.has(endpoint.groupSlug)) {
        groups.set(endpoint.groupSlug, {title: endpoint.groupTitle, url: groupUrl, items: []});
        redirects.set(groupUrl, url);
      }
      groups.get(endpoint.groupSlug).items.push({
        type: 'doc',
        id: docId,
        label: data.title,
        className: `api-method api-method--${data.method.toLowerCase()}`,
        customProps: {method: data.method},
      });
    }

    const sidebarItems = [...groups.values()].map((group) => ({
      type: 'category',
      label: group.title,
      collapsible: true,
      collapsed: true,
      items: group.items,
    }));
    const firstUrl = pages.find((p) => p.api === apiName && p.url.startsWith('/' + urlSegments.join('/')))?.url;
    return {items: sidebarItems, firstUrl, redirects};
  }

  /** Look up `GET /markets` in a REST API (defaults to the first one). */
  function findOperation(operation, apiName) {
    const [method, ...rest] = operation.trim().split(/\s+/);
    const apiPath = rest.join(' ');
    const names = apiName ? [apiName] : [...specs.keys()].filter((n) => specs.get(n).type === 'openapi');
    for (const name of names) {
      const page = byOperation.get(`${name} ${method.toUpperCase()} ${apiPath}`);
      if (page) return page;
    }
    return undefined;
  }

  return {resolve, pages, specs, findOperation};
}
