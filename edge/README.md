# Edge layer (MCP server and agent Markdown)

The site is a static Docusaurus build. Fern's servers did more than serve
files to AI agents, and this layer puts that behaviour back. It is plain
Web-standard JavaScript (`Request` -> `Response`, ES modules, no Node APIs, no
dependencies) and runs on Cloudflare in one of two ways:

- **Cloudflare Pages**: `functions/_middleware.js` runs it in front of the build.
- **A standalone Worker** in front of another origin, such as GitHub Pages:
  `edge/worker.mjs`.

GitHub Pages on its own cannot run code. Without one of the two set-ups, the
static files still work, but nothing in the list below does.

## What it does

| Request | Response |
|---|---|
| `GET /_mcp/server` | JSON descriptor of the docs MCP server (Fern's `fern-docs-mcp-server`), `Cache-Control: public, s-maxage=60, stale-while-revalidate=60`, `Vary: Accept` |
| `POST /_mcp/server` (also `POST`/`DELETE /mcp`, trailing slashes allowed) | Stateless MCP Streamable HTTP server. Tools: `searchDocs` (ranked results from our own index) and `fetchPage` (a page's Markdown) |
| A page URL with `Accept` containing `text/markdown` or `text/plain` | `303` to `<page>.md` (query kept; `/` goes to `/.md`) |
| `<page>.md`, `<page>.mdx` | The page's agent Markdown with `Content-Type: text/markdown; charset=utf-8`, `X-Robots-Tag: noindex` and Fern's cache headers. `/.md` serves `/home.md` |
| `<page>.md?lang=python`, `?excludeSpec=true` | API pages filtered like Fern: `lang` keeps one language's code samples, `excludeSpec=true` drops the schema sections |
| The `.md` of a redirected URL | `308` (permanent rule) or `307` to the destination's `.md`, query kept, `X-Robots-Tag: noindex`. Uses the host's redirect when it applies `_redirects` (Cloudflare Pages), else the build's `/_redirects` rules (GitHub Pages behind the Worker) |
| A missing `.md` | `200 text/plain` "# Page Not Found" with up to three similar pages (Fern's agent not-found) |
| `<path>/llms.txt` | `Content-Type` is `text/markdown` when `Accept` asks for it, otherwise `text/plain`; `Vary: Accept`. A missing one gets the agent not-found |
| `/llms-full.txt` | Our full concatenation (kept on purpose). A missing `<section>/llms-full.txt` gets a `301` to `<section>/llms.txt`, as on Fern |
| `/.well-known/api-catalog` | RFC 9727 linkset with `Content-Type: application/linkset+json; profile=...` and `Link: <...>; rel="api-catalog"`. Uses the build's file if there is one, otherwise lists `/api/prod` and `/api/testnet` with their OpenAPI files |
| Anything else | Passed through untouched |

The behaviour, status codes, headers and texts follow what Fern's production
bundle does (see the comments in each module). Deliberate differences:

- `searchDocs` runs Fern's "structured" search mode against
  `/_mcp/search-index.json` (BM25F ranking, no LLM and no external service).
  Fern's default mode answered with text written by its AI chat service.
  The ranking boosts pages whose title is the question ("Liquidations" for
  "when does liquidation happen?"), ignores question filler words, matches
  -ing/-ed forms and a few API verb synonyms (place/create, get/list,
  subscribe/channel), and ranks release notes slightly lower than the
  pages they describe.
- Fern's `reportIssue` tool is not implemented.
- A request cancelled (`notifications/cancelled`) in the same batch as the
  request gets no response and the stream still closes. The SDK Fern used
  would keep that stream open.
- Request limits of the current MCP SDK (1.32), which Fern's bundled SDK
  did not have: a body over 4 MiB gets `413` (-32000 "Payload Too Large"),
  a batch of more than 100 messages `400` (-32600). `searchDocs` uses the
  first 2,048 characters and the first 48 distinct words of a query, and
  the not-found suggestions skip slugs longer than 256 characters, so no
  single request can exhaust a Worker isolate's memory or CPU.
- `HEAD /_mcp/server` answers an empty `500`. That reproduces Fern, whose
  route threw on HEAD (read from its code, not observed live). No client
  relies on it.

### Modules

| File | Contents |
|---|---|
| `core.mjs` | `handle(request, options)`: routing, negotiation, `.md`, `llms.txt`, api-catalog, search-index cache |
| `mcp.mjs` | MCP server: descriptor, transport rules, `initialize`/`ping`/`tools/*`, the two tools, `fetchPage` path resolution |
| `jsonrpc.mjs` | JSON-RPC message checks and the SDK's parameter validation errors, without zod |
| `search.mjs` | Tokenizer, inverted index and ranking for `searchDocs` |
| `paths.mjs` | Linear-time slash trimming and collapsing for client-supplied paths |
| `markdown.mjs` | `?lang=` / `?excludeSpec=` filters, the agent not-found body, Fern's route suggestions |
| `worker.mjs`, `../functions/_middleware.js` | Hosting adapters |
| `*.test.mjs`, `fixtures.mjs` | Tests and the in-memory fixture site they use |

### What it needs from the build

The edge only reads files of the build, through the host's asset fetcher. It
never fetches other origins: the adapters build every asset and origin URL
from the fixed origin by setting only its path (never by resolving a path
against a base URL), and repeated slashes in client paths are collapsed, so
`//host/x`, `/\host/x` or a fetchPage path such as `/.//host/x` stays a path
on the docs site.

- `<page>.md` and `<page>/llms.txt` for every page, section and tab URL, in
  Fern's agent format. `/home.md` is the home page.
- `/_mcp/search-index.json`:
  `{"version":1,"site":...,"pages":[{"url","title","kind","breadcrumbs"}],"sections":[{"page","anchor","heading","text"}]}`.
  It is loaded on the first search in each isolate.
- Endpoint pages written with the markers that `plugins/llms-api.mjs`
  documents: the `Reference: <url>` line, schema headings
  (`## Authentication` to `## Types`), `## Examples`, the `**Code Samples**`
  and `**SDK Code**` paragraphs, and fences tagged `<language>[ <name>]`.

## The `DOCS_MCP_SERVER` build switch

The build writes the MCP line into the root `llms.txt` instructions and into
the preamble of every `.md` and section `llms.txt`: "For AI client
integration (Claude Code, Cursor, etc.), connect to the MCP server at
https://docs.paradex.trade/_mcp/server". It leaves that line out when the
build runs with `DOCS_MCP_SERVER=off`.

- Local builds and builds deployed with this edge layer leave the variable
  unset, so the line is written.
- `.github/workflows/publish-docs.yml` deploys to plain GitHub Pages, where
  no MCP server exists, so its build step sets `DOCS_MCP_SERVER: off`.
  Remove that setting once the Worker runs in front of GitHub Pages.

At the edge, `DOCS_MCP_SERVER=off` (a Pages or Worker variable) turns the
server off in the same way as Fern's per-site switch:
`404 {"error":"MCP is disabled for this docs site"}`.

## Deploying

### Option A: Cloudflare Pages

`wrangler.toml` at the repo root describes the Pages project (`paradex-docs`,
output directory `build`, variable `SITE_URL`). Wrangler picks up
`functions/` automatically.

```bash
yarn build
npx wrangler@4 pages deploy build
```

With Git integration instead, use `yarn build` as the build command and
`build` as the output directory. Then point `docs.paradex.trade` at the
Pages project.

`static/_routes.json` (copied to `build/_routes.json` by the build) keeps
`/assets/*` off the Function. That matters for cost: without it, every
request, including each JS, CSS and image file, invokes the Function, and
that counts against the Functions request quota. The middleware passes
those requests through after a cheap check, but the invocation is still
counted.

The build's `_redirects` lists its exact rules before its splat (`/*`)
rules, because Cloudflare Pages treats every line below the first splat as
a dynamic rule and ignores everything after the 100th. On Pages the
Function asks for files with `redirect: 'manual'`, so the `.md` twin of a
legacy URL (`/old.md /new.md 308`) reaches the client as a redirect, as on
Fern.

### Option B: a Worker in front of GitHub Pages

1. Put `paradex.trade` on Cloudflare. Make `docs` a proxied (orange-cloud)
   CNAME to `tradeparadex.github.io`, and keep the custom domain set in the
   repository's Pages settings.
2. Uncomment `routes` in `edge/wrangler.worker.toml`, then deploy:

   ```bash
   npx wrangler@4 deploy --config edge/wrangler.worker.toml
   ```

3. Remove `DOCS_MCP_SERVER: off` from `publish-docs.yml` so the published
   Markdown advertises the server.

On its route, the Worker sends pass-through requests and file reads to the
zone's origin, which is GitHub Pages. Set `ORIGIN` only when the build is
served from a hostname that does not redirect back to the docs domain, for
example a `*.pages.dev` project. GitHub Pages redirects its `github.io` URL
to the custom domain. `SEARCH_INDEX_TTL` (default 600 seconds) sets how long
an isolate keeps the search index before it fetches it again, since GitHub
Pages can redeploy while the Worker stays up.

### CPU budget

The first `searchDocs` call in a fresh isolate fetches, parses and indexes
`/_mcp/search-index.json`. For the full site this takes roughly 50 to 150 ms
of CPU. Later searches take a few milliseconds. The Workers Free plan
allows 10 ms of CPU per request, so use the Workers Paid plan (on Pages,
enable the paid Functions usage model) for the MCP server to work reliably.

## Testing

Unit and integration tests run on Node with no dependencies. They use an
in-memory fixture site and cover every route, header and MCP error case:

```bash
yarn test:edge          # node --test edge/*.test.mjs
```

CI runs them in `.github/workflows/build-docs.yml`.

To run the real thing locally in the Workers runtime:

```bash
yarn build
npx wrangler@4 pages dev build --binding SITE_URL=http://localhost:8788
```

`SITE_URL` makes the MCP descriptor and search results use the local host.
Without it they point at production, although `fetchPage` still reads the
local build. Then try:

```bash
curl -i -H 'Accept: text/markdown' http://localhost:8788/docs/getting-started/what-is-paradex
curl -i http://localhost:8788/_mcp/server
curl -s -X POST http://localhost:8788/_mcp/server \
  -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"searchDocs","arguments":{"query":"cancel all orders"}}}'

claude mcp add --transport http paradex-docs http://localhost:8788/_mcp/server
```

`wrangler pages dev` writes a `.wrangler/` state directory in the current
directory. Do not commit it.
