# Options multi-asset documentation

## Pattern

Options instrument config pages live in `fern/pages/instruments-guide/dated-options/` with one `.mdx` file per asset (e.g. `btc-usd.mdx`, `eth-usd.mdx`, `hype-usd.mdx`, `sol-usd.mdx`, `zec-usd.mdx`, `us500-usd.mdx`). Each page follows the same table layout — product type, symbol format, base/quote/settlement currencies, tick sizes, order limits, band factors.

Sidebar entries for options are under `- section: Options` inside the Instruments Guide in `fern/docs.yml`.

## Per-asset parameter tables

Several pages use `<Tabs>` with one tab per asset (BTC, ETH, HYPE, SOL, ZEC, US500) when parameters differ per underlying. Crypto underlyings come first, TradFi (US500) last:

| Page | Section |
|---|---|
| `fern/pages/dated-options/expiries-and-listing.mdx` | Strike step sizes |
| `fern/pages/dated-options/margin-requirements.mdx` | Cross margin parameters |
| `fern/pages/risk-system/portfolio-margin.mdx` | SCAN scenario tables, Min-delta coefficients, Parameters table |

When adding a new options underlying, update all four locations: instrument config page, sidebar, expiries/listing, margin requirements, and portfolio margin.

## US500 specifics

- CL (Crude Oil) options were delisted when US500 options launched (with a redirect from `/trading/instruments-guide/options/cl-options` to `/trading/dated-options`), then relisted in PR #1423 (`cl-usd.mdx`). The stale redirect was removed when the CL index/settlement section was added; a redirect for a live page shadows it. CL uses the same weighted-median oracle as XAU minus Stork (Pyth, Hyperliquid, Lighter, OKX, Bybit 24/7; Binance open hours; Closing/Internal Price closing hours; total 5.7 in both states), with sources tracking the front-month WTI future.
- US500 margin parameters (cross margin and portfolio margin: SCAN scenarios, min-delta coefficients, `MIN_VOL_SHOCK_UP`) match BTC identically.
- US500 strike step sizes use the standard 4 time buckets: $25/$25/$50, $50/$50/$100, $50/$100/$250, $100/$250/$500 (ATM/Outer/Wings).
- US500 contract spec: 0.01 US500 order size increment, 100 US500 max order size, 200 US500 position limit, 40% spot and IV band factors.
- TradFi options (US500, US100, XAU) are priced off the Paradex Spot Oracle Price of the same underlying as the perp and settle at its 30-minute TWAP ending at expiry; the intro sentence of each page states both. Each instrument page has an "Index and settlement price" section listing sources, scores and open/closing hour weights (source: team spreadsheet "Paradex TradFi spot index price"). Equity indices (US500, US100) use only Pyth, Hyperliquid and Lighter as external sources (scores 1/1/0.7, all 24/7) plus Closing Price and Internal Price (0.5 each) in closing hours; XAU uses the full set (Pyth, Stork, Hyperliquid, Lighter, OKX, Bybit, Binance). The equity index case is also in the "Equity Indices Pricing" section of `fern/pages/trading/real-world-assets.mdx` (slug `/trading/tradfi-markets`).
- TradFi option pages state market hours per asset: US500/US100 follow the CME equity index futures session and XAU the CME commodity session (both Sunday 6 PM to Friday 5 PM ET, daily 5-6 PM ET break), matching `CalendarFor` in mono `pkg/market_asset/market/calendars.go`. Single stocks use the 24/5 equities session instead. Each page also carries a worked weighted-median example for open and closing hours.
- The live URL for the US500 perp page is `/trading/instruments-guide/futures/trad-fi/us500-usd-perp` (`fern/docs.yml` pins `slug: trad-fi` on the TradFi section so the dead-link check, which slugifies `TradFi` as `tradfi`, agrees with Fern).

## META specifics (first single-stock dated option)

- META (`meta-usd.mdx`, added 2026-10-01) is the first single-stock underlying to get a dated-options page — prior TradFi pages were all indices/commodities (US500, US100, XAU, CL). Its internal market config (`external_data_mapping`) references an OPRA options feed and an ESSVI vol-surface publisher, which has no public doc equivalent — confirmed with the user before writing the public-facing section that single stocks should still be documented using the same weighted-median Spot Oracle Price model as other TradFi underlyings, just with the full generic source set.
- META uses the **generic** "Source scores"/"Source weights by market state" table already at the top of `fern/pages/trading/real-world-assets.mdx` verbatim: Pyth (3, open hours only — stocks/FX score differs from the commodities/equity-index score of 1), Stork (2, open hours), Binance (1, open hours), Bybit/Hyperliquid/OKX (1 each, 24/7), Lighter (0.7, 24/7), Closing Price/Internal Price (0.5 each, closing hours). Total 9.7 open / 4.7 closing — matches the generic table exactly, so that table doubles as the single-stock default; don't assume it's commodity/index-specific.
- META market hours use the **equities (single stock)** session — 24/5, Sunday 8 PM ET to Friday 8 PM ET including pre/post-market and overnight — not the CME 23/5 session used by XAU/CL/US500/US100.
- Confirmed Pyth, Stork, Binance, Bybit, Hyperliquid, OKX and Lighter all actually list META price feeds/perpetuals via web search before writing source links — don't assume a crypto venue covers a given stock just because it covers others; verify per-symbol, since not every venue lists every "Magnificent 7" name.
- META margin params are its own (not copied from BTC/US500): cross-margin Long/Short ITM/OTM 50/35/25% (IMR), min-delta Unhedged/Hedged 3%/1.5%, `MIN_VOL_SHOCK_UP` 60% (same bucket as HYPE/SOL), strike steps $2.5/$2.5/$5 → $10/$25/$50 across the 4 time buckets.

## Gotchas

- Portfolio Margin SCAN scenarios (spot shocks, vol shocks, tail weights) are sourced from the live endpoint `https://api.prod.paradex.trade/v1/system/portfolio-margin-config`. Each asset has its own spot-shock ladder and tail weights (e.g. BTC ±14/10.5/7/3.5%, ETH ±16/12/8/4%, SOL ±24/18/12/6%, HYPE ±28/21/14/7%); do not assume BTC/ETH or HYPE/SOL match. Regenerate all four tabs from the JSON when updating. Note the endpoint only returned BTC/ETH/SOL/HYPE when last checked, so the US500 tab (copied from BTC per product guidance) may not be verifiable against it.
- SOL uses the same strike step sizes and SCAN vol shocks as HYPE, but its own spot shocks, tail weights, and cross-margin fractions (Long ITM 25%, Short ITM 18%, Short OTM 12%).
- The Mark Price reference-exchange table (`fern/pages/dated-options/mark-price.mdx`) only lists BTC, ETH, and HYPE; SOL and US500 are not listed there.
- The Portfolio Margin `Parameters` section at the bottom of `portfolio-margin.mdx` contains constants that are mostly shared across assets; `MIN_VOL_SHOCK_UP` and `HEDGED_MARGIN_FACTOR` are the exceptions (HYPE/SOL = 60% / 1.5% vs BTC/ETH/US500 = 40% / 1%).
- ZEC options are present on `main` as of 2026-09-22 (instrument page, sidebar entry, margin requirements tab, portfolio margin SCAN tab and min-delta row) even though an earlier note recorded their removal. Check the live files rather than trusting this file for ZEC status.

## Last updated

2026-10-01
