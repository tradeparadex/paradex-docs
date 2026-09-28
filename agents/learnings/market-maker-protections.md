# Market Maker Protections (MMP) page

Page: `fern/pages/trading/market-maker-protections.mdx`, served at `/trading/market-maker-protections` (Trading tab, listed after FastFills in `docs.yml`).

## Gotchas

- MMP endpoints (`/v1/account/mmp...`) and the private `mmp` WebSocket channel are not yet in the synced OpenAPI/AsyncAPI specs, so the page documents them inline. Once the specs include them, consider linking out.
- The initial product spec differed from the implementation. Verified behavior (keep these when editing):
  - There is a single reset route, `POST /v1/account/mmp/reset`, with an optional `base_asset` body. There is no per asset reset path. Responses are wrapped in `results`. Partial refusals return 400 with `data.reset` and `data.refused`.
  - `interval_ms` range is 100 to 3600000; `0` is rejected. `DELETE` is the only way to remove a configuration.
  - `MMP_NOT_CONFIGURED` is a 400 only for reset. At order entry the order is accepted and then canceled with that reason.
  - Supported markets are perps and dated options (name only these; do not mention perpetual options on the page), and clients cannot set the MMP flag on block trade legs.
  - Five cancel reasons, including `MMP_GREEKS_UNAVAILABLE` (cancels all MMP orders on the underlying, perps included).
  - RFQ/block trade coverage is a per account, per base asset opt in, `protect_block_trades` (default `false`), documented in the "RFQ and block trades" section. It is the exception to the full replace rule: omitting it keeps the stored value; only `false` turns it off. Clients cannot set the MMP flag on legs; the server sets it. Which legs get it depends on the path (this has been corrected several times, keep the split):
    - Creating a block directly: maker legs only, and never the requester of a block built from offers.
    - Submitting an offer: the offering account's own legs, on either side (maker or taker).
    - `MARKET` legs are never flagged.
    - A flagged leg counts toward the window by its own side, maker or taker.
  - Protection is fixed at block creation. Leg flags are visible only to the leg owner. Block and offer creation can return 503 if MMP settings cannot be read, even for accounts without MMP. Do not document a per quote RFQ flag.
  - Order book counting is maker only: only the resting maker's MMP flagged fill counts; a flagged order that crosses the book is not counted, so delta and vega limits trip on gross maker exposure. This applies to the order book only, not to block trade legs; avoid wording like "taker fills do not count" that would read across both.
  - The arriving order's own flag still gates entry: `MMP_FROZEN` and `MMP_NOT_CONFIGURED` still apply to incoming MMP orders. The stale Greeks check at arrival only applies to orders that can rest (an MMP `LIMIT` `IOC` is not canceled for stale Greeks); stated in the Greeks warning.
  - `GET /v1/account/mmp` accepts read only tokens; writes need a trading JWT. Reset limit is 60/minute per account plus a short burst limit; the burst limit is not per account, so do not publish a per second number. `POST`/`DELETE` return 503 when market data is temporarily unavailable; only reset returns 503 because the matching engine is unavailable. Reset with a read only token returns `INVALID_TOKEN_SCOPE` (403).
  - Reset all returns 400 only for the 1 second lockout; underlying assets without a configuration are skipped and the call still returns 200.
  - `MMP_DISABLED` also fires when MMP is temporarily unavailable (for example a restart), not only on `DELETE`.
  - A configuration listed while `enabled` is `false` is still enforced until deleted. Posting an identical configuration again does not clear the window.
  - `INVALID_FILL` means a fill could not be counted, so the underlying is frozen as a precaution.
  - `paradex-py` 0.7.1 is the first SDK version with `MMP` in `OrderFlag`; older versions cannot parse MMP flagged orders or protected block trade legs. Documented in "SDK support".
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
