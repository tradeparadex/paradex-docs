# DIME Utility page

`fern/pages/trading/dime-utility.mdx` is served at `/dime/dime-utility` (the `dime` tab in `docs.yml`, slug `dime-utility`). Note there are two other `dime-utility.mdx` files (`introduction/` and `instruments-guide/spot/dime-usd.mdx`); the `dime` tab maps to the `trading/` one.

## Patterns

- \$DIME fee discounts (Stake \$DIME, Pay fees in \$DIME) apply only to **Pro taker fees on Perps & Spot**. Keep this framing explicit. Do not imply they apply to Retail fees (0% maker and taker) or Pro maker fees (flat 0.3 bps / 0.003%).
- Discount sections live under a `## Fee Discounts` H2 with `### Pay Fees in \$DIME` and `### Stake \$DIME` H3s. The tiered staking table and the `Dot` `export const` helper live under Stake \$DIME.
- Escape dollar signs as `\$DIME` in prose and table cells to avoid MathJax-style parsing.
- Link to `/trading/trading-fees` for the full fee schedule rather than restating volume tiers here.

## Last updated
2026-07-07
