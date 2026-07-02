# Trading fees page

## Gotchas

- The `/staking` redirect in `fern/docs.yml` points at a specific anchor on the Trading Fees page. Current target: `#stake-dime` (H3 `### Stake $DIME` under the `## Discounts` section). If the "Stake \$DIME" subheading is renamed, update the redirect in `docs.yml` to match.
- Escape dollar signs as `\$` in MDX (e.g. `\$DIME`) to prevent MathJax-style parsing in prose and table cells.
- `fern/pages/trading/trading-fees-v2.mdx` is an orphaned duplicate (not referenced in `docs.yml`, and the `/trading/trading-fees-v2` URL is already redirected to `/trading/trading-fees`). A previous deletion of the file was reverted by the team. Leave it in place and edit `trading-fees.mdx` as canonical.

## Patterns

- Frame the page around the mental model: `taker fee = base rate × (1 − total discount)`, with a Pro minimum of 1.75 bps (0.0175%). Pro maker fees are a separate flat rate.
- Information architecture:
  1. `## Perps & Spot Fees` → `### Retail` (simple 0% table) and `### Pro` which splits into `#### Maker fees` (flat rate) and `#### Taker fees` (volume-based with discounts).
  2. Under `#### Taker fees`: `##### Base rate` (volume-tier table, taker only), `##### Discounts` with `###### Stake $DIME`, `###### Pay fees in $DIME`, `###### FastFills`, and `##### Fee scenarios`.
  3. `## Options Fees`: Retail and Pro sub-sections.
  4. `## Settlement`: delisting fees.
- Use full words in the wide scenario table (e.g. `Fee Discount`, `Total Discount`) instead of abbreviations like `DC`.
- Prefix each staking tier name in the Staking Tier table with a colored dot using the `<Dot color="#..." />` helper defined via `export const` at the top of `trading-fees.mdx`. The helper wraps the inline-block span with camelCase style keys (`borderRadius`, `backgroundColor`, `marginRight`, `verticalAlign`) that Vale flags as spelling errors when written inline in prose, so keep the span inside the `export const` block (which `.vale.ini`'s `BlockIgnores` skips). Tier colors: Base `#B9BBBD`, Wood `#A0764E`, Bronze `#C4693D`, Silver `#B9BBBD`, Gold `#FFB23D`, Platinum `#A97DBF`, Diamond `#69B8BF`. The Base row represents the default (0 \$DIME staked, 0% discount) state.

## Anti-patterns

- Do not use em-dashes (—) in prose. Use colons, commas, parentheses, or a restructured sentence instead. Em-dashes are only acceptable inside table cells (e.g. as a placeholder for "not applicable").
- Don't pile scannability aids at the top (e.g., long "at a glance" bullet lists or large `CardGroup`s). They duplicate information that the structured sections already present and make the intro feel wordy.
- Don't re-list the NFT threshold as a separate "discount." It's part of the Retail base-rate eligibility, so it belongs inline in the Retail tab table.
- Don't split Retail and Pro into two stacked tables without a `Tabs` switcher. Readers have to scroll past a table that doesn't apply to them.

## Last updated
2026-07-02
