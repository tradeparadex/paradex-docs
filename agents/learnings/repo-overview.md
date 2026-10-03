# Repository overview

The site is built with [Docusaurus](https://docusaurus.io) (open source) and hosted on Cloudflare: a Worker (`wrangler.toml`) that serves the build as static assets, with the edge layer in `edge/` in front. It replaced Fern in October 2026; URLs, navigation, anchors, redirects and page layouts were kept identical to the Fern site.

## Main folders and what they contain

| Folder | Purpose |
|---|---|
| `docs/navigation.yml` | Tabs, sidebars and URL slugs (same schema as Fern's `docs.yml` navigation) |
| `docs/redirects.yml` | Redirects from old URLs (`:slug*` wildcards supported) |
| `docs/pages/` | MDX content pages organized by topic (trading, accounts, risk, etc.) |
| `docs/pages/generated/` | Generated API reference pages (gitignored, rebuilt on every build) |
| `docs/release-notes/prod/` | Changelog entries, one `MM-DD-YYYY.mdx` per release date, plus `overview.mdx` (intro text) |
| `docs/snippets/` | Reusable MDX snippets, included with `<Markdown src="..." />` |
| `docs/assets/` | Images and PDFs referenced from content |
| `docs/apis/prod_rest/`, `docs/apis/testnet_rest/` | REST specs: `openapi/openapi.json` (synced from the API) + `openapi/overrides.yml` (code samples, group/method names) |
| `docs/apis/prod_ws/` | WebSocket spec (AsyncAPI 2.6.0 YAML) |
| `plugins/` | Build-time code: navigation/URL rules, API reference generator, redirects, agent outputs (llms*.mjs), MDX compatibility |
| `src/components/fern/` | MDX components (Card, Tabs, Accordion, Steps, Note, ...) with Fern's names and props |
| `src/components/api/` | REST endpoint / WebSocket channel page component |
| `src/theme/` | Docusaurus theme overrides (two-row header, page header, breadcrumbs, changelog, 404 redirects) |
| `src/css/` | Theme (`custom.css`), components, API pages, home page (`landing.css`), Tailwind subset used by content |
| `src/clientModules/` | Cookie consent, home page marquee, TVL limit, KaTeX CSS, sidebar scroll |
| `src/head/` | Inline head scripts: Google Consent Mode defaults, Meta pixel |
| `static/assets/` | Logos and favicon |
| `scripts/` | Release-note scaffolding, OpenAPI sync, Swagger conversion, site check |
| `.github/workflows/` | Build and Cloudflare preview (PRs), publish to Cloudflare (main), Vale, dead links, OpenAPI sync |
| `edge/` | The Cloudflare Worker: MCP server, Markdown negotiation, `.md`/llms.txt headers. `edge/README.md` covers hosting, deploys, cutover and rollback |

## How the site is assembled

- `docusaurus.config.ts` calls `loadSite()` (`plugins/site.mjs`) once at startup. It generates the API pages, reads `navigation.yml`, and computes every page URL, sidebar, header tab and redirect.
- Page URLs come from `navigation.yml`, not from file paths. A page's URL is its tab slug + section slugs + its own `slug` (or its title in kebab case, via lodash `kebabCase`, as Fern did). `slug: ""` on a section adds no segment. A `slug` in a page's front matter is the full path (used by the home page).
- Tab and section URLs without their own page redirect to their first page (`/trading` -> `/trading/overview`), as on Fern.
- REST endpoint URLs are `<section>/<group>/<method>`: group from `x-fern-sdk-group-name` in `overrides.yml` or the first tag; method from `x-fern-sdk-method-name`, else the operationId minus a leading tag prefix, else the summary. WebSocket channel URLs are the channel address in kebab case, twice. Do not change these rules: they reproduce Fern's public URLs.
- Release notes use the Docusaurus blog plugin at `/releases/changelog`; entry URLs are `/releases/changelog/YYYY/M/D` (no zero padding). RSS/Atom/JSON feeds: `/releases/changelog/rss.xml`, `atom.xml`, `feed.json`.
- Redirects: `plugins/site-plugin.mjs` adds a real route (a small redirect page that keeps the `#hash`) for every old URL it can enumerate; the 404 page applies the wildcard rules in the browser for anything else; `build/_redirects` carries the rules for hosts with server-side redirects.
- Every page also has a Markdown copy at `<url>.md`, plus `/llms.txt`, `/llms-full.txt`, per-section `llms.txt` and `/openapi.json|yaml`, `/asyncapi.json|yaml` (generated after the build). See "Agent outputs" below.
- Search is `@easyops-cn/docusaurus-search-local` (offline index, works on static hosting). It only works in `yarn build && yarn serve`, not in `yarn dev`.

## Agent outputs (llms.txt, .md, MCP)

These reproduce what Fern served to AI agents. `plugins/llms.mjs` writes them in `postBuild` (after the HTML, which the search index reads):

- `<url>.md` for every page, in Fern's "llm" format: an agent preamble blockquote ("For clean Markdown of any page...", the llms.txt link and, when enabled, the MCP line), `# title` (front-matter title, else the navigation title), the front-matter `description` as a `>` blockquote, then the body. The body is the MDX run through a port of Fern's `filterMarkdownForLlm` on a real syntax tree (`plugins/llms-markdown.mjs`): callouts become `> **Note**` blockquotes, titled components (Card, Tab, Step, Accordion, ...) become `#### title`, other components are unwrapped or dropped (`<ChangelogTags/>`, `<Icon/>`), lowercase HTML becomes Markdown, `<llms-only>` is kept and `<llms-ignore>` dropped, `export const` values are substituted and snippets inlined. Relative images point at the built assets. A page that fails to parse falls back to a simple conversion with a build warning.
- REST endpoint and WebSocket pages use Fern's API layout (`plugins/llms-api.mjs`): `METHOD url`, `Reference:`, schema sections (`## Authentication`, `## Request`, `## Response`, `## Errors`, `## Types`), `## Examples` with `**SDK Code**` fences (authored `x-fern-examples` samples first, verbatim, then the generated ones in Fern's order: python, javascript, go, ruby, java, php, csharp, swift; no curl); WebSocket pages carry an AsyncAPI YAML block whose payloads are named like Fern's (`<Channel>Subscribe`, nested `Channels<Channel>Subscribe<Prop>`). Checked byte for byte against 46 pages captured from `fern docs dev`. The comment at the top of that file lists the markers the edge layer uses for `?lang=` and `?excludeSpec=true`.
- Tab, section and API group URLs get a copy of the `.md` of the page they redirect to (`/docs.md`, `/api/prod.md`). `/.md` is served as `/home.md` (edge rewrite, plus a `/.md /home.md 308` line in `_redirects`). Exact legacy redirects get `.md` twins (`/old.md /new.md 308`).
- `/llms.txt` (root index with "Instructions for AI Agents"), and `<url>/llms.txt` for every tab, section, API group and page in Fern's non-root format (preamble, `# title` or the page's own Markdown, `## Docs`, `## API Docs`, spec links). The changelog's lists its entries (`## Entries`); `/releases/changelog.md` holds the 20 newest entries. `plugins/llms-nav.mjs` rebuilds Fern's navigation tree for this.
- `/llms-full.txt`: every docs and API page's Markdown concatenated, without preambles (Fern now redirects this URL to `/llms.txt`; we keep the full file on purpose).
- `/_mcp/search-index.json` (`plugins/llms-search.mjs`): pages and their H2/H3 sections with the real anchors, searched by the MCP server.
- `/.well-known/api-catalog` (RFC 9727 linkset pointing at `/openapi/rest-endpoints*.yaml`) and `robots.txt` (Fern's default text, in `static/`).
- The docs MCP server (`/_mcp/server`, Fern's `fern-docs-mcp-server` with `searchDocs` and `fetchPage`), content negotiation (`Accept: text/markdown` -> `.md`), the `.md`/llms.txt headers and the agent not-found answers live in the edge layer in `edge/` (the Cloudflare Worker), not in the static build.
- `DOCS_MCP_SERVER=off` at build time removes the MCP bullet from `/llms.txt` and the MCP line from every preamble; builds default to on. Only use it together with `DOCS_MCP_SERVER = "off"` in `wrangler.toml`, which turns the server itself off.
- Cloudflare applies `build/_redirects` (real 301/308s) and `build/_headers` (from `static/_headers`: HSTS, immutable caching of hashed `/assets/*` subfolders) and serves `404.html` for unknown paths. The client-side redirect pages and the 404 page's redirect fallback remain, but the server rules answer first.

## How to run and test

- `yarn install` (Yarn 4 via corepack; `.yarnrc.yml` uses the node-modules linker).
- `yarn dev`: local dev server on http://localhost:3000.
- `yarn build`: production build into `build/`. Fails on broken internal links, MDX errors and a bad `navigation.yml`. Takes a few minutes (about 750 pages).
- `yarn serve`: serve the build (search works here).
- `yarn check`: after a build, checks that every URL the Fern site served (`scripts/legacy-urls.txt`) still resolves to a page or redirect, plus the generated extras.
- `yarn test:edge`: unit tests of the edge layer (MCP server, `.md`/llms.txt routes, search ranking). `node --test edge/` does not work on Node 22 (it runs the directory as a module); use the script.
- `npx wrangler@4 dev` (after `yarn build`): runs the Worker and the build's static assets in the real Workers runtime on http://localhost:8787, with Cloudflare's `_redirects`, `_headers`, trailing-slash and 404 handling. See `edge/README.md`.
- `yarn typecheck`: TypeScript check of `src/`.
- `vale docs/pages docs/snippets docs/release-notes`: prose lint (CI runs it on every PR).

## Content authoring notes

- Use the Fern-style components (`<Card>`, `<CardGroup cols>`, `<Tabs><Tab title>`, `<Accordion>`, `<Steps>`, `<Note>`, `<Tip>`, `<Warning>`, `<Info>`, `<Error>`, `<Frame caption>`, `<Icon icon="fa-solid fa-...">`, `<Badge>`, `<Button>`, `<CodeBlocks>`, `<ChangelogTags>`). They are registered globally; no imports needed.
- Icons are Font Awesome **Free** (`plugins/icons.mjs`). Pro-only names used by older pages are mapped to free equivalents there; add a mapping if a new Pro name shows up in the build warning.
- `<Markdown src="../snippets/x.mdx" />` inlines the snippet before compilation, so it can use the page's `export const` values (instrument pages rely on this).
- Relative image paths in `<img src="../../assets/x.png">` and `<Frame>` are bundled automatically.
- `{Identifier}` text that the page does not define renders literally (e.g. `ZEC-USD-{Expiry}`), as Fern did.
- Front matter: `title`, `subtitle` (shown under the title), `description`, `hide-toc: true`, `layout: reference` (wide, no TOC) or `layout: custom` (full width, no chrome; home page).
- Tab, Accordion and Step titles get anchor ids (`#closing-hours`, then `#closing-hours-1`), matching Fern. Linking to `#<slug>` opens the tab/accordion.
- Meta description follows Fern's rule (`plugins/markdown-text.mjs`): `description`, else `subtitle`, else the first prose paragraph (snippets inlined), cut to 160 characters. API pages use the operation's `description` the same way.
- API reference anchors are Fern's: `#request.body.<field>`, `#request.query.<name>`, `#request.path.<name>`, `#request.header.<name>`, `#response.body.<field>` (nested fields add `.<name>`), `#response.error`, and `#send.publish` / `#receive.subscribe` on WebSocket pages. Changelog headings get the entry date in front (`#2025-10-16-v11169`); dates on the index are `#2026-10-02T00:00:00.000Z`.
- `Title:` (capital T) in front matter is ignored, as Fern ignored it; the navigation title is used.

## Gotchas

- Release notes must stay outside `docs/pages/`: a file under both the docs and blog plugin paths is compiled twice and fails.
- A new page must be listed in `navigation.yml`; files not listed are not published (several old drafts in `docs/pages/` are intentionally unpublished).
- Do not edit `docs/apis/*/openapi/openapi.json` by hand; the sync workflow overwrites it. Put docs-only changes in `overrides.yml`.
- The site is dark only (Fern rendered it dark only).
- Shell commands such as `pkill -f "<pattern>"` can kill the calling shell when the pattern appears in the command line itself; prefer killing by PID.
- The `.md` serializer is mdast-util-to-markdown with Fern's options, so lists use `*` bullets, tables are re-padded and `$`, `{`, `<` in text are escaped (`\$DIME`). That is what Fern produced; do not "fix" it by hand.
- MDX parses `<li>...</li>` written one per line inside `<ul>` as inline elements in a paragraph; the `.md` conversion first runs Fern's "unravel" step (a paragraph made only of inline JSX and whitespace becomes flow elements), so they come out as list items, as on Fern.
- `mdast-util-to-markdown` is pinned to 2.1.2 (`resolutions` in `package.json`): 2.1.3 stopped escaping intraword `_` and encodes a newline after a hard break as `&#xA;`, which Fern's serializer did not.
- `build/_redirects` must list exact rules before splat (`/*`) rules: Cloudflare counts every line below the first splat as dynamic and ignores everything after the 100th (and static rules after the 2,000th). `toNetlifyRedirects()` does this and `yarn check` enforces it; keep it that way when adding rules or extra lines.
- `run_worker_first` in `wrangler.toml` keeps `/assets/*` off the Worker (cost); the Worker still sees every page URL, since Accept negotiation applies to them.
- Merging to `main` deploys to production (`publish-docs.yml`). CI's Wrangler replaces an existing DNS record for docs.paradex.trade without asking, so the first deploy was the cutover from Fern.

## Last updated

2026-10-03
