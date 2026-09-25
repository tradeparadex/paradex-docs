# Market Maker Protections (MMP) page

Page: `fern/pages/trading/market-maker-protections.mdx`, served at `/trading/market-maker-protections` (Trading tab, listed after FastFills in `docs.yml`).

## Gotchas

- MMP endpoints (`/v1/account/mmp...`) and the private `mmp` WebSocket channel are not yet in the synced OpenAPI/AsyncAPI specs, so the page documents them inline instead of linking to generated API reference pages. Once the specs include them, consider linking out.
- The synced OpenAPI spec already contains an `MMP_CONFIG_INVALID` error code that the product spec did not list. Confirm with the team before documenting it.
- Escape dollar amounts as `\$` in the Portfolio Margin example.

## Patterns

- Feature is whitelisted only; the page opens with a `<Note>` component stating this.
- Portfolio Margin relief section links to `/risk/portfolio-margin`.
- Prose avoids hyphens per `writing-style.md` (e.g. "MMP enabled", "order book", "cross market", "orders without the MMP flag" instead of "non-MMP").

## Last updated

2026-09-25
