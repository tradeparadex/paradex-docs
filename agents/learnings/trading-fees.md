# Trading fees page

## Gotchas

- The `/staking` redirect in `fern/docs.yml` points at a specific anchor on the Trading Fees page. Current target: `#stake-dime` (H3 `### Stake $DIME` under the `## Discounts` section). If the "Stake \$DIME" subheading is renamed, update the redirect in `docs.yml` to match.
- Escape dollar signs as `\$` in MDX (e.g. `\$DIME`) to prevent MathJax-style parsing in prose and table cells.
- `fern/pages/trading/trading-fees-v2.mdx` is an orphaned duplicate (not referenced in `docs.yml`, and the `/trading/trading-fees-v2` URL is already redirected to `/trading/trading-fees`). A previous deletion of the file was reverted by the team. Leave it in place and edit `trading-fees.mdx` as canonical.

## Patterns

- Frame the page around the mental model: `fee = base rate × (1 − total discount)`, with a Pro minimum of 1.75 bps (0.0175%).
- Information architecture:
  1. `## How fees work`: short lead paragraph with the formula and floor.
  2. `## Your base rate`: `<Tabs>` split into `<Tab title="Retail">` and `<Tab title="Pro">`, each with its own volume-tier table. NFT thresholds stay inline in the Retail table (they modify the base rate, not a post-hoc discount).
  3. `## Discounts`: H3 subsections for each actionable lever (`### Stake $DIME`, `### Pay fees in $DIME`, `### FastFills (Pro only)`), preceded by a short bulleted preview of the three levers for scannability.
  4. `## Worked examples`: the scenarios table combining volume tier + discounts.
  5. `## Other fees`: H3 for Options and Settlement (secondary products).
  6. `## FAQ`: `<AccordionGroup>`.
- Use full words in the wide scenario table (e.g. `Fee Discount`, `Total Discount`) instead of abbreviations like `DC`.
- Prefix each staking tier name in the Staking Tier table with a colored dot using the `<Dot color="#..." />` helper defined via `export const` at the top of `trading-fees.mdx`. The helper wraps the inline-block span with camelCase style keys (`borderRadius`, `backgroundColor`, `marginRight`, `verticalAlign`) that Vale flags as spelling errors when written inline in prose, so keep the span inside the `export const` block (which `.vale.ini`'s `BlockIgnores` skips). Tier colors: Base `#B9BBBD`, Wood `#A0764E`, Bronze `#C4693D`, Silver `#B9BBBD`, Gold `#FFB23D`, Platinum `#A97DBF`, Diamond `#69B8BF`. The Base row represents the default (0 \$DIME staked, 0% discount) state.

## Anti-patterns

- Do not use em-dashes (—) in prose. Use colons, commas, parentheses, or a restructured sentence instead. Em-dashes are only acceptable inside table cells (e.g. as a placeholder for "not applicable").
- Don't pile scannability aids at the top (e.g., long "at a glance" bullet lists or large `CardGroup`s). They duplicate information that the structured sections already present and make the intro feel wordy.
- Don't re-list the NFT threshold as a separate "discount." It's part of the Retail base-rate eligibility, so it belongs inline in the Retail tab table.
- Don't split Retail and Pro into two stacked tables without a `Tabs` switcher. Readers have to scroll past a table that doesn't apply to them.

## Last updated
2026-04-23
