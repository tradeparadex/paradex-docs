# Repository overview

## Main folders and what they contain

| Folder | Purpose |
|---|---|
| `fern/` | All Fern documentation configuration and content |
| `fern/docs.yml` | Root documentation config: navigation, tabs, styling, instances |
| `fern/fern.config.json` | Fern org config (org: `paradex`, CLI version: `3.42.1`) |
| `fern/pages/` | MDX content pages organized by topic (trading, accounts, risk, etc.) |
| `fern/apis/prod_rest/` | Production REST API spec (OpenAPI JSON + overrides) |
| `fern/apis/prod_ws/` | Production WebSocket API spec (AsyncAPI 2.6.0 YAML) |
| `fern/apis/testnet_rest/` | Testnet REST API spec (OpenAPI JSON + overrides) |
| `fern/snippets/` | Reusable MDX snippets (contract templates, verify-connection) |
| `fern/assets/` | Static assets: images, fonts (HarmonyOS Sans family), CSS, JS |
| `fern/dist/` | Compiled JS (pixel tracking script) |
| `scripts/` | Utility scripts for Swagger-to-OpenAPI conversion and landing page updates |
| `.vale/` | Vale prose linting styles and vocab |
| `.github/workflows/` | CI workflows for Fern check, Vale check, docs preview, publish, deadlink check, and OpenAPI sync |

## Key dependencies and version constraints

- **Fern CLI**: `fern-api` v3.31.1+ (pinned in `package.json` as devDependency)
- **Fern config version**: `3.42.1` (in `fern/fern.config.json`)
- **Package manager**: Yarn 4.5.3 (set via `packageManager` field in `package.json`)
- **swagger2openapi**: v7.0.8 (devDependency, used by conversion script)
- **Vale**: installed via `snap` in CI; styles based on `US-English`
- **Node.js**: required for Fern CLI and scripts (no explicit version pin)

## Documentation structure

The site uses tabs for top-level navigation:

- **Home** - Landing page
- **Overview** - Getting started, architecture, XP and referrals
- **Trading** - Order types, fees, vaults, instruments, accounts
- **Risk & Liquidations** - Risk system documentation
- **Paradex Chain** - Chain-specific docs
- **Ecosystem** - Ecosystem pages
- **REST API** - Auto-generated from OpenAPI spec (`prod_rest`)
- **WebSocket API** - Auto-generated from AsyncAPI spec (`prod_ws`)
- **Agentic AI Hub** - AI-related documentation
- **Release Notes** - Versioned release notes (e.g., `v1.135.md`)

Two instances are configured:

- Production: `https://docs.paradex.trade` (custom domain)
- Dev: `https://paradex-dev.docs.buildwithfern.com`

## How to run and test

- **Local dev server**: `yarn dev` (runs `fern docs dev`)
- **Fern check**: `fern check --warnings` (runs in CI on PRs touching `fern/`)
- **Vale linting**: `vale fern/` (runs in CI on all PRs)
- **Deadlink check**: runs lychee for external links and a custom Python script for internal links (CI on PRs)
- **Preview docs**: CI generates a preview URL on PRs touching `fern/`
- **Publish docs**: merges to `main` touching `fern/` trigger `fern generate --docs`

## Non-standard and custom patterns

### API spec syncing

- A scheduled workflow (`sync-openapi.yml`) runs Mon-Fri to pull the latest OpenAPI spec from `https://api.prod.paradex.trade/swagger/doc.json` using the `fern-api/sync-openapi@v2` action.
- The `convert-swagger-to-openapi.js` script exists to convert Swagger 2.0 specs to OpenAPI 3.0 if needed.

### Landing page release automation

- `scripts/update-landing-releases.py` scans `fern/pages/release-notes/` for versioned files and updates the "What's new" section of `what-is-paradex.mdx` with the two latest versions.

### Custom fonts and JS

- The site uses HarmonyOS Sans font family (multiple weights as `.woff2` files in `fern/assets/`).
- Custom JS files exist for home page animations (`home-page.js`), wallet connect (`wallet-connect.js`), TVL limit display (`tvl-limit.js`), and pixel tracking (`fern/dist/add-pixel.js`).

### Vale configuration

- Vale is configured for `US-English` style with spelling set to `error` level.
- Custom vocab lists are used: `Patterns`, `Domain`, `Technical`, `General`.
- MDX export lines and JSX attributes are ignored via `BlockIgnores` and `TokenIgnores`.

### Instruments guide pages

- The `fern/pages/instruments-guide/` folder contains per-instrument pages (futures organized by tier, options, spot), likely using shared snippet templates from `fern/snippets/contractTemplate*.mdx`.

## Gotchas

- The `fern check` CI workflow only triggers on changes inside `fern/`, but Vale runs on all PRs.
- The deadlink checker distinguishes between truly dead links (404/410) and transient errors, only failing on the former.
- OpenAPI overrides are used for the prod REST API (`./openapi/overrides.yml`), so raw spec edits may be overwritten by the sync workflow.

## Patterns

- Content pages are `.mdx` files organized under `fern/pages/` by topic area.
- Navigation structure is defined entirely in `fern/docs.yml` with explicit slugs.
- Reusable content uses snippet files in `fern/snippets/`.

## Anti-patterns

- Do not edit `fern/apis/prod_rest/openapi/openapi.json` directly; changes will be overwritten by the sync workflow. Use overrides instead.
- Do not skip Vale checks; they run on every PR.

## Last updated

2026-03-16
