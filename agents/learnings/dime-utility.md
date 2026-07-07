# DIME Utility page

`fern/pages/trading/dime-utility.mdx` is served at `/dime/dime-utility` (the `dime` tab in `docs.yml`, slug `dime-utility`). Note there are two other `dime-utility.mdx` files (`introduction/` and `instruments-guide/spot/dime-usd.mdx`); the `dime` tab maps to the `trading/` one.

## Patterns

- \$DIME fee discounts (Stake \$DIME, Pay fees in \$DIME) apply to **Pro taker fees on Perps & Spot**. State this scope concisely (a single lead sentence). Avoid enumerating what the discounts do not cover (Retail 0% fees, Pro maker flat 0.3 bps): it reads as defensive and overshadows the benefit. Link to Trading Fees for the rest.
- Discount sections live under a `## Fee Discounts` H2 with `### Pay Fees in \$DIME` and `### Stake \$DIME` H3s. The tiered staking table and the `Dot` `export const` helper live under Stake \$DIME.
- Escape dollar signs as `\$DIME` in prose and table cells to avoid MathJax-style parsing.
- Link to `/trading/trading-fees` for the full fee schedule rather than restating volume tiers here.

## Last updated
2026-07-07
