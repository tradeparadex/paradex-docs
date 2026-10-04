# Hosting and edge layer

docs.paradex.trade is a Cloudflare Worker (`paradex-docs`, configured in
`wrangler.toml` at the repo root). The Docusaurus build in `build/` is the
Worker's static assets, and `edge/worker.mjs` runs in front of them to add
what Fern's servers did for AI agents. Cloudflare serves the files and
applies the build's `_redirects` and `_headers`; it serves `404.html` with a
`404` for unknown paths.

`/assets/*` (hashed JS, CSS, images and fonts) never invokes the Worker
(`run_worker_first` in `wrangler.toml`). Every other request does, because
Accept negotiation applies to every page URL. Requests that need nothing
from the edge layer go straight to the assets after a cheap URL/header
check.

The edge layer is plain Web-standard JavaScript (`Request` -> `Response`,
ES modules, no Node APIs, no dependencies).

## What it does

| Request | Response |
|---|---|
| `GET /_mcp/server` | JSON descriptor of the docs MCP server (Fern's `fern-docs-mcp-server`), `Cache-Control: public, s-maxage=60, stale-while-revalidate=60`, `Vary: Accept` |
| `POST /_mcp/server` (also `POST`/`DELETE /mcp`, trailing slashes allowed) | Stateless MCP Streamable HTTP server. Tools: `searchDocs` (ranked results from our own index) and `fetchPage` (a page's Markdown) |
| A page URL with `Accept` containing `text/markdown` or `text/plain` | `303` to `<page>.md` (query kept; `/` goes to `/.md`) |
| `<page>.md`, `<page>.mdx` | The page's agent Markdown with `Content-Type: text/markdown; charset=utf-8`, `X-Robots-Tag: noindex` and Fern's cache headers. `/.md` serves `/home.md` |
| `<page>.md?lang=python`, `?excludeSpec=true` | API pages filtered like Fern: `lang` keeps one language's code samples, `excludeSpec=true` drops the schema sections |
| The `.md` of a redirected URL | `308` (permanent rule) or `307` to the destination's `.md`, query kept, `X-Robots-Tag: noindex`. Cloudflare matches the build's `_redirects`, which has a `.md` twin of every exact rule and of every wildcard rule whose destination has no `:slug*` |
| A missing `.md` | `200 text/plain` "# Page Not Found" with up to three similar pages (Fern's agent not-found) |
| `<path>/llms.txt` | `Content-Type` is `text/markdown` when `Accept` asks for it, otherwise `text/plain`; `Vary: Accept`. A missing one gets the agent not-found, and so does one under an old URL prefix that `_redirects` would redirect (Fern's llms.txt route ignored redirects) |
| `/llms-full.txt` | Our full concatenation (kept on purpose). A missing `<section>/llms-full.txt` gets a `301` to `<section>/llms.txt`, as on Fern |
| `/.well-known/api-catalog` | RFC 9727 linkset with `Content-Type: application/linkset+json; profile=...` and `Link: <...>; rel="api-catalog"`. Uses the build's file if there is one, otherwise lists `/api/prod` and `/api/testnet` with their OpenAPI files |
| Anything else | Passed to the static assets untouched |

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
| `worker.mjs` | The Worker entry: `env.ASSETS` as the file source, `SITE_URL` and `DOCS_MCP_SERVER` from the environment |
| `*.test.mjs`, `fixtures.mjs` | Tests and the in-memory fixture site they use |

### What it needs from the build

The edge only reads files of the build, through `env.ASSETS`. It never
fetches other origins: the Worker builds every asset URL from the request's
origin by setting only its path (never by resolving a path against a base
URL), and repeated slashes in client paths are collapsed, so `//host/x`,
`/\host/x` or a fetchPage path such as `/.//host/x` stays a path on the docs
site.

- `<page>.md` and `<page>/llms.txt` for every page, section and tab URL, in
  Fern's agent format. `/home.md` is the home page.
- `/_mcp/search-index.json`:
  `{"version":1,"site":...,"pages":[{"url","title","kind","breadcrumbs"}],"sections":[{"page","anchor","heading","text"}]}`.
  It is loaded on the first search in each isolate and kept for the isolate's
  life (a deploy starts new isolates).
- Endpoint pages written with the markers that `plugins/llms-api.mjs`
  documents: the `Reference: <url>` line, schema headings
  (`## Authentication` to `## Types`), `## Examples`, the `**Code Samples**`
  and `**SDK Code**` paragraphs, and fences tagged `<language>[ <name>]`.

## The `DOCS_MCP_SERVER` switch

The build writes the MCP line into the root `llms.txt` instructions and into
the preamble of every `.md` and section `llms.txt`: "For AI client
integration (Claude Code, Cursor, etc.), connect to the MCP server at
https://docs.paradex.trade/_mcp/server". `DOCS_MCP_SERVER=off yarn build`
leaves it out.

In `wrangler.toml` `[vars]`, `DOCS_MCP_SERVER = "off"` turns the server off
like Fern's per-site switch: `404 {"error":"MCP is disabled for this docs
site"}`. Turn it off in both places together.

## Deploying

CI deploys; nobody needs to run Wrangler by hand.

- **Production**: `.github/workflows/publish-docs.yml` builds and runs
  `wrangler deploy` on every push to `main`. It pins Wrangler with
  `WRANGLER_VERSION`.
- **Pull requests**: `.github/workflows/build-docs.yml` builds and checks
  the site and attaches the build to the run as the `docs-site` artifact
  (serve it with `npx wrangler@4 dev`). There are no Cloudflare previews: a
  token that can upload a Worker version can also deploy one, Cloudflare
  tokens cannot be limited to a single Worker, and a pull request can edit
  the workflow it runs. So no deploy credential may be readable from a pull
  request run.

### One-time setup

1. The `paradex.trade` zone must be active on Cloudflare, in the account
   that will own the Worker. Workers custom domains need the zone on
   Cloudflare; a CNAME from another DNS provider does not work.
2. Create an API token from the "Edit Cloudflare Workers" template, limited
   to that account and the `paradex.trade` zone.
3. In Settings > Environments, create (or edit) the `production`
   environment: set "Deployment branches and tags" to `main` only, and add
   the environment secrets `CLOUDFLARE_API_TOKEN` (the token) and
   `CLOUDFLARE_ACCOUNT_ID`. Don't store them as repository secrets: those
   are readable from any branch's workflow runs, including pull requests.
4. Subscribe the account to the Workers Paid plan (see "CPU budget").

### Cutover from Fern

The first deploy, on the merge to `main`, attaches docs.paradex.trade to the
Worker (`routes` in `wrangler.toml`). Wrangler in CI replaces the
hostname's existing DNS record, the CNAME to Fern (`cname.vercel-dns.com`),
without asking, so the merge is the cutover. Without the secrets the deploy
fails and docs.paradex.trade keeps serving the last Fern publish.

To go back to Fern, in this order:

1. Stop CI from re-attaching the domain: remove `routes` from
   `wrangler.toml` on `main` (or disable `publish-docs.yml`). Otherwise the
   next push to `main` takes the hostname back.
2. Remove the custom domain from the Worker (Worker > Settings > Domains &
   Routes). The custom domain owns the `docs` DNS record, so the record
   can't be changed while it is attached.
3. Recreate the `docs` CNAME to `cname.vercel-dns.com`.

Fern keeps serving its last publish until the domain is removed there.

### Rollback

`npx wrangler@4 rollback` (or the Worker's Deployments tab in the dashboard)
puts a previous version back at 100% in seconds. Reverting the commit on
`main` deploys again through CI.

### Limits

`yarn check` fails the build when it would break one of Cloudflare's limits:
2,000 static and 100 dynamic `_redirects` rules (every line below the first
splat counts as dynamic, so `toNetlifyRedirects()` writes exact rules
first), 20,000 files (Workers Free; Paid allows 100,000) and 25 MiB per file.

### CPU budget

The first `searchDocs` call in a fresh isolate fetches, parses and indexes
`/_mcp/search-index.json`. For the full site this takes roughly 50 to 150 ms
of CPU. Later searches take a few milliseconds. The Workers Free plan
allows 10 ms of CPU per request, so the MCP server needs the Workers Paid
plan to work reliably. Paid also covers the request volume: every page
view invokes the Worker.

## Testing

Unit and integration tests run on Node with no dependencies. They use an
in-memory fixture site and cover every route, header and MCP error case:

```bash
yarn test:edge          # node --test edge/*.test.mjs
```

CI runs them in `.github/workflows/build-docs.yml` and before each deploy.

To run the real thing locally in the Workers runtime, with Cloudflare's
handling of `_redirects`, `_headers`, trailing slashes and 404s:

```bash
yarn build
npx wrangler@4 dev --var SITE_URL:http://localhost:8787
```

`SITE_URL` makes the MCP descriptor and search results use the local host.
Without it they point at production, although `fetchPage` still reads the
local build. Then try:

```bash
curl -i -H 'Accept: text/markdown' http://localhost:8787/docs/getting-started/what-is-paradex
curl -i http://localhost:8787/_mcp/server
curl -s -X POST http://localhost:8787/_mcp/server \
  -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"searchDocs","arguments":{"query":"cancel all orders"}}}'

claude mcp add --transport http paradex-docs http://localhost:8787/_mcp/server
```

`wrangler dev` writes a `.wrangler/` state directory in the current
directory (ignored by git).
