# Funding Mechanism page

## Gotchas

- The funding pipeline updates **every 1 second**, not every 5 seconds.
- The old v1 page has been removed and v2 was renamed to the canonical `funding-mechanism` page. There is only one Funding Mechanism page now.
- The Mark Price Calculation page (`fern/pages/risk-system/mark-price-calculation.mdx`) now uses the Fair Basis description from the former v1 page (median-of-medians with liquidity weight), which is the authoritative description for on-venue-based Fair Basis. The Funding Mechanism page uses the impact-premium-based approach for funding rate calculation.
- `funding-mechanism` uses an impact-premium-based approach (weighted median of per-venue VWAPs), not the Fair Basis median-of-medians approach from the former v1 page.
- The Funding Index does **not** advance when the gap since the previous tick exceeds 30s (outage, oracle maintenance, market pause). Positions accrue no funding during a pause and there is no "next funding" countdown to backfill.

## Patterns

- Page structure follows the seven-step pipeline: Per-venue impact premium -> Aggregation -> Raw Funding Rate -> Smoothed Funding Rate -> Funding Premium -> Funding Index -> Accrued Funding.
- Rates (`baseline_rate`, `clamp_rate`, `max_funding_rate`) are quoted per the market's Funding Period (default 8h).
- Per-market parameters are summarized in a defaults table; for live values, link out to the `market-details` REST endpoint under `../api/prod/market/get-markets`.
- The worked example uses a steady-state assumption over a 1-minute window so the arithmetic stays tractable.

## Anti-patterns

- Do not recreate a separate v1/v2 split. There is only one Funding Mechanism page.
- Do not quote the Funding Premium in "per second" units. The Premium is quoted per funding period (default 8h) so it stays comparable to rates on other venues.

## Last updated
2026-06-17
