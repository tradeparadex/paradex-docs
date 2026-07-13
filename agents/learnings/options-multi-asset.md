# Options multi-asset documentation

## Pattern

Options instrument config pages live in `fern/pages/instruments-guide/dated-options/` with one `.mdx` file per asset (e.g. `btc-usd.mdx`, `eth-usd.mdx`, `hype-usd.mdx`, `cl-usd.mdx`). Each page follows the same table layout — product type, symbol format, base/quote/settlement currencies, tick sizes, order limits, band factors.

Sidebar entries for options are under `- section: Options` inside the Instruments Guide in `fern/docs.yml`.

## Per-asset parameter tables

Several pages use `<Tabs>` with one tab per asset (BTC, ETH, HYPE, CL) when parameters differ per underlying:

| Page | Section |
|---|---|
| `fern/pages/dated-options/expiries-and-listing.mdx` | Strike step sizes |
| `fern/pages/dated-options/margin-requirements.mdx` | Cross margin parameters |
| `fern/pages/risk-system/portfolio-margin.mdx` | SCAN scenario tables, Min-delta coefficients, Parameters table |

When adding a new options underlying, update all four locations: instrument config page, sidebar, expiries/listing, margin requirements, and portfolio margin.

## CL (Crude Oil) specifics

- CL only has 2 weekly expiries (1w and 2w); no daily or monthly cycles.
- If an expiry falls on a weekend or public holiday (per the Pyth CL calendar), it rolls to the next business day.
- CL strike step sizes only have 2 time buckets (8h–7d and 7d–16d) instead of the 4 used by other assets.
- CL margin parameters (cross margin and portfolio margin) match HYPE identically.

## Gotchas

- ETH SCAN scenarios and cross-margin parameters currently match BTC identically. HYPE and CL values differ (higher spot/vol shocks, different tail weights, higher ITM/OTM fractions).
- The Portfolio Margin `Parameters` section at the bottom of `portfolio-margin.mdx` contains constants that are mostly shared across assets; `MIN_VOL_SHOCK_UP` and `HEDGED_MARGIN_FACTOR` are the exceptions (HYPE/CL = 60% / 1.5% vs BTC/ETH = 40% / 1%).
- ZEC options were delisted and removed from the docs. The instrument config page, sidebar entry, and per-asset tabs (expiries/listing, margin requirements, portfolio margin SCAN + min-delta) were deleted, and a redirect was added from `/trading/instruments-guide/options/zec-options` to `/trading/dated-options`. Note ZEC still exists as a perpetual future (`zec-usd-perp.mdx`) — only options were removed.

## Last updated

2026-07-13
