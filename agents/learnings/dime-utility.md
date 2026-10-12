# DIME Utility page

`fern/pages/trading/dime-utility.mdx` is served at `/dime/dime-utility` (the `dime` tab in `docs.yml`, slug `dime-utility`). Note there are two other `dime-utility.mdx` files (`introduction/` and `instruments-guide/spot/dime-usd.mdx`); the `dime` tab maps to the `trading/` one.

## Patterns

- \$DIME fee discounts (Stake \$DIME, Pay fees in \$DIME) apply to **Pro taker fees on Perps & Spot**. State this scope concisely (a single lead sentence). Avoid enumerating what the discounts do not cover (Retail 0% fees, Pro maker flat 0.3 bps): it reads as defensive and overshadows the benefit. Link to Trading Fees for the rest.
- Discount sections live under a `## Fee Discounts` H2 with `### Pay Fees in \$DIME` and `### Stake \$DIME` H3s. The tiered staking table and the `Dot` `export const` helper live under Stake \$DIME.
- Escape dollar signs as `\$DIME` in prose and table cells to avoid MathJax-style parsing.
- Link to `/trading/trading-fees` for the full fee schedule rather than restating volume tiers here.

## DIME section (Overview tab)

The Overview tab has a `DIME` section with `slug: ""` with two pages. Use `slug: ""` (not `skip-slug: true`) to keep pages at the parent URL level: the CI internal link checker does not understand `skip-slug` and reports the pages as broken links.
- `fern/pages/introduction/dime.mdx` ("DIME", `/docs/getting-started/dime`): general token info only (supply, decimals, networks, contract addresses).
- `fern/pages/introduction/dime-utility.mdx` ("DIME Utility", `/docs/getting-started/dime-utility`): Buybacks, Fee Discounts, Gas. Keep in sync with `trading/dime-utility.mdx`.

- Solana \$DIME (`3ywtR9qQH4BuA7LSfLvEuW1gh6ha7EK18XwLbHvhryPZ`, 9 decimals, Hyperlane warp route) comes from CoinGecko and is not in system config.
- Source of truth for addresses: `bridged_tokens` (DIME entry) and `dime_staking_contract_address` in `https://api.prod.paradex.trade/v1/system/config`. Total supply and decimals can be confirmed with `totalSupply()` / `decimals()` on the Ethereum token contract.
- Link circulating supply and other live token stats to `https://app.paradex.trade/dime/overview`, not CoinGecko.
- Link Ethereum addresses to Etherscan and Paradex Chain addresses to `https://app.paradex.trade/explorer/contract/<address>`.

## Last updated
2026-10-11
