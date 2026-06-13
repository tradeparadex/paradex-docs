# Options multi-asset documentation

## Pattern

Options instrument config pages live in `fern/pages/instruments-guide/dated-options/` with one `.mdx` file per asset (e.g. `btc-usd.mdx`, `eth-usd.mdx`, `hype-usd.mdx`, `zec-usd.mdx`). Each page follows the same table layout — product type, symbol format, base/quote/settlement currencies, tick sizes, order limits, band factors.

Sidebar entries for options are under `- section: Options` inside the Instruments Guide in `fern/docs.yml`.

## Per-asset parameter tables

Several pages use `<Tabs>` with one tab per asset (BTC, ETH, HYPE, ZEC) when parameters differ per underlying:

| Page | Section |
|---|---|
| `fern/pages/dated-options/expiries-and-listing.mdx` | Strike step sizes |
| `fern/pages/dated-options/margin-requirements.mdx` | Cross margin parameters |
| `fern/pages/risk-system/portfolio-margin.mdx` | SCAN scenario tables, Min-delta coefficients, Parameters table |

When adding a new options underlying, update all four locations: instrument config page, sidebar, expiries/listing, margin requirements, and portfolio margin.

## Gotchas

- ETH SCAN scenarios and cross-margin parameters currently match BTC identically. HYPE and ZEC values differ (higher spot/vol shocks, different tail weights, higher ITM/OTM fractions).
- ZEC margin parameters (cross margin and portfolio margin) match HYPE identically.
- The Portfolio Margin `Parameters` section at the bottom of `portfolio-margin.mdx` contains constants that are mostly shared across assets; `MIN_VOL_SHOCK_UP` and `HEDGED_MARGIN_FACTOR` are the exceptions (HYPE/ZEC = 60% / 1.5% vs BTC/ETH = 40% / 1%).

## Last updated

2026-06-13
