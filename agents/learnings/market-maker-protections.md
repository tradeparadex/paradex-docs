# Market Maker Protections (MMP) page

Page: `fern/pages/trading/market-maker-protections.mdx`, served at `/trading/market-maker-protections` (Trading tab, listed after FastFills in `docs.yml`).

## Gotchas

- MMP endpoints (`/v1/account/mmp...`) and the private `mmp` WebSocket channel are not yet in the synced OpenAPI/AsyncAPI specs, so the page documents them inline. Once the specs include them, consider linking out.
- The initial product spec differed from the implementation. Verified behavior (keep these when editing):
  - There is a single reset route, `POST /v1/account/mmp/reset`, with an optional `base_asset` body. There is no per asset reset path. Responses are wrapped in `results`. Partial refusals return 400 with `data.reset` and `data.refused`.
  - `interval_ms` range is 100 to 3600000; `0` is rejected. `DELETE` is the only way to remove a configuration.
  - `MMP_NOT_CONFIGURED` is a 400 only for reset. At order entry the order is accepted and then canceled with that reason.
  - Supported markets are perps and dated options. Perpetual options and block trade legs are rejected.
  - Five cancel reasons, including `MMP_GREEKS_UNAVAILABLE` (cancels all MMP orders on the underlying, perps included).
  - RFQ quotes have no MMP flag and RFQ/block trade fills do not count toward the window. Do not document a per quote RFQ flag.
  - `GET /v1/account/mmp` accepts read only tokens; writes need a trading JWT. Reset limits: 5/second and 60/minute per account. `POST`/`DELETE` return 503 when market data is temporarily unavailable; only reset returns 503 because the matching engine is unavailable. Reset with a read only token returns `INVALID_TOKEN_SCOPE` (403).
  - Reset all returns 400 only for the 1 second lockout; underlying assets without a configuration are skipped and the call still returns 200.
  - WebSocket `window_*`, `trip_reason` (`SIZE`, `DELTA`, `VEGA`, `INVALID_FILL`) and `trigger_market` are only on `TRIGGERED`; `config` (with `removed`) is on `CONFIG_UPDATED`; `frozen_until` is `0` on non `TRIGGERED` events.
- Do not expose internal component names (for example "execution gate" or "matching path") or source file references. Describe behavior in user terms and refer to "the matching engine".
- Lowercase "vega" needed `[Vv]ega` in `.vale/styles/config/vocabularies/Domain/accept.txt` (CI Vale 3.17 flagged it).
- Escape dollar amounts as `\$` in the Portfolio Margin example.

## Patterns

- Feature is whitelisted only; the page opens with a `<Note>` component stating this.
- Portfolio Margin relief section links to `/risk/portfolio-margin`. Read only tokens link to `/api/general-information/api-authentication#readonly-tokens`.
- Prose avoids hyphens per `writing-style.md` (e.g. "MMP enabled", "order book", "cross market", "orders without the MMP flag" instead of "non-MMP").

## Last updated

2026-09-25
