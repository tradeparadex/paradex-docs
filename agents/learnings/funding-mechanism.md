# Funding Mechanism page

## Gotchas

- The funding pipeline updates **every 1 second**, not every 5 seconds. The Mark Price Calculation page (`fern/pages/risk-system/mark-price-calculation.mdx`) still says "every 5 seconds" and lists only Bybit/Binance/OKX as external venues, while funding now also consumes Hyperliquid and Lighter. Revisit that page whenever the two must be kept consistent.
- `funding-mechanism` preserves the per-market `Funding Multiplier` (0..1, 0.5 for TradFi markets). The internal spec omits it because it assumes 1, but TradFi markets use 0.5, so it must stay in the `Raw Rate` formula.
- The Funding Index does **not** advance when the gap since the previous tick exceeds 30s (outage, oracle maintenance, market pause). Positions accrue no funding during a pause and there is no "next funding" countdown to backfill.

## Patterns

- Page structure follows the six-step pipeline: Fair Basis → Raw Funding Rate → Smoothed Funding Rate → Funding Premium → Funding Index → Accrued Funding. The "Pipeline overview" list at the top mirrors this ordering so readers can jump to any stage.
- Fair Basis detail on this page complements, but does not duplicate, Mark Price Calculation: this page covers the median-of-medians blend, the liquidity weight `w`, and the external venue list used to construct Fair Basis; cross-link to `mark-price-calculation#steps-to-calculate-the-fair-basis-and-the-mark-price` for the mark-price side of the computation.
- Rates (`baseline_rate`, `clamp_rate`, `max_funding_rate`) are quoted per the market's Funding Period (default 8h) and scaled by `FundingPeriodHours / 8` for non-8h markets, so the "per 8h" defaults remain the interpretable frame even when markets override the period.
- Per-market parameters are summarized in a defaults table at the bottom of the page; for live values, link out to the `market-details` REST endpoint under `../api/prod/market/get-markets`.
- The worked example uses a steady-state assumption over a 1-minute window so the arithmetic of `Δ → Raw Rate → Premium → Index → PnL` stays tractable; the per-8h extrapolation at the end doubles as a sanity check on the formulas.

## Anti-patterns

- Do not drop the existing `funding_rate_clamping_diagram.png` when restructuring the page. It's the only visual on Raw Rate clamping behavior.
- Do not use em-dashes (—) in prose on this page; use colons, commas, or parentheses. Em-dashes are only acceptable inside table cells.
- Do not quote the Funding Premium in "per second" units. The Premium is quoted per funding period (default 8h) so it stays comparable to rates on other venues; the per-tick advance of the index is what converts it into accrued USDC over a holding window.

## Last updated
2026-04-23
