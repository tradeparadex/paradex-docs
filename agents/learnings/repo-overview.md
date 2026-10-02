# Repository overview

The site is built with [Docusaurus](https://docusaurus.io) (open source) and deployed to GitHub Pages. It replaced Fern in October 2026; URLs, navigation, anchors, redirects and page layouts were kept identical to the Fern site.

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
| `plugins/` | Build-time code: navigation/URL rules, API reference generator, redirects, llms.txt, MDX compatibility |
| `src/components/fern/` | MDX components (Card, Tabs, Accordion, Steps, Note, ...) with Fern's names and props |
| `src/components/api/` | REST endpoint / WebSocket channel page component |
| `src/theme/` | Docusaurus theme overrides (two-row header, page header, breadcrumbs, changelog, 404 redirects) |
| `src/css/` | Theme (`custom.css`), components, API pages, home page (`landing.css`), Tailwind subset used by content |
| `src/clientModules/` | Cookie consent, home page marquee, TVL limit, KaTeX CSS, sidebar scroll |
| `src/head/` | Inline head scripts: Google Consent Mode defaults, Meta pixel |
| `static/assets/` | Logos and favicon |
| `scripts/` | Release-note scaffolding, OpenAPI sync, Swagger conversion, site check |
| `.github/workflows/` | Build (PRs), publish to GitHub Pages (main), Vale, dead links, OpenAPI sync |

## How the site is assembled

- `docusaurus.config.ts` calls `loadSite()` (`plugins/site.mjs`) once at startup. It generates the API pages, reads `navigation.yml`, and computes every page URL, sidebar, header tab and redirect.
- Page URLs come from `navigation.yml`, not from file paths. A page's URL is its tab slug + section slugs + its own `slug` (or its title in kebab case, via lodash `kebabCase`, as Fern did). `slug: ""` on a section adds no segment. A `slug` in a page's front matter is the full path (used by the home page).
- Tab and section URLs without their own page redirect to their first page (`/trading` -> `/trading/overview`), as on Fern.
- REST endpoint URLs are `<section>/<group>/<method>`: group from `x-fern-sdk-group-name` in `overrides.yml` or the first tag; method from `x-fern-sdk-method-name`, else the operationId minus a leading tag prefix, else the summary. WebSocket channel URLs are the channel address in kebab case, twice. Do not change these rules: they reproduce Fern's public URLs.
- Release notes use the Docusaurus blog plugin at `/releases/changelog`; entry URLs are `/releases/changelog/YYYY/M/D` (no zero padding). RSS/Atom/JSON feeds: `/releases/changelog/rss.xml`, `atom.xml`, `feed.json`.
- Redirects: `plugins/site-plugin.mjs` adds a real route (a small redirect page that keeps the `#hash`) for every old URL it can enumerate; the 404 page applies the wildcard rules in the browser for anything else; `build/_redirects` carries the rules for hosts with server-side redirects.
- Every page also has a Markdown copy at `<url>.md`, plus `/llms.txt`, `/llms-full.txt`, per-section `llms.txt` and `/openapi.json|yaml`, `/asyncapi.json|yaml` (generated after the build).
- Search is `@easyops-cn/docusaurus-search-local` (offline index, works on static hosting). It only works in `yarn build && yarn serve`, not in `yarn dev`.

## How to run and test

- `yarn install` (Yarn 4 via corepack; `.yarnrc.yml` uses the node-modules linker).
- `yarn dev`: local dev server on http://localhost:3000.
- `yarn build`: production build into `build/`. Fails on broken internal links, MDX errors and a bad `navigation.yml`. Takes a few minutes (about 750 pages).
- `yarn serve`: serve the build (search works here).
- `yarn check`: after a build, checks that every URL the Fern site served (`scripts/legacy-urls.txt`) still resolves to a page or redirect, plus the generated extras.
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

## Gotchas

- Release notes must stay outside `docs/pages/`: a file under both the docs and blog plugin paths is compiled twice and fails.
- A new page must be listed in `navigation.yml`; files not listed are not published (several old drafts in `docs/pages/` are intentionally unpublished).
- Do not edit `docs/apis/*/openapi/openapi.json` by hand; the sync workflow overwrites it. Put docs-only changes in `overrides.yml`.
- The site is dark only (Fern rendered it dark only).
- Shell commands such as `pkill -f "<pattern>"` can kill the calling shell when the pattern appears in the command line itself; prefer killing by PID.

## Last updated

2026-10-02
