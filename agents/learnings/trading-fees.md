# Trading fees page

## Gotchas

- The H2 heading `## Staking discounts (Pro & Retail)` produces the anchor `#staking-discounts-pro--retail`, which is the destination of the `/staking` redirect in `fern/docs.yml`. Do not rename this heading without also updating the redirect.
- The H2 heading `## \$DIME fee discounts (Pro & Retail)` produces the anchor `#dime-fee-discounts-pro--retail` and is referenced from the in-page `Ways to save on fees` CardGroup. Keep these in sync.
- Escape dollar signs in `$DIME` as `\$DIME` in MDX prose and table cells to avoid MathJax-style parsing.

## Patterns

- Keep the intro scannable with a `## Fees at a glance` bulleted summary, followed by a `## Ways to save on fees` `CardGroup` whose cards link to the discount sections below.
- Use full words in wide scenario tables (e.g., `Fee Discount`, `Total Discount`) instead of `DC` abbreviations — dense fee tables are hard to parse when columns are cryptic.
- Preserve the stacking order when describing discounts: volume tier → staking discount → \$DIME fee discount → FastFills discount (Pro only), subject to the 1.75 bps Pro minimum.

## Anti-patterns

- `fern/pages/trading/trading-fees-v2.mdx` exists as a duplicate of `trading-fees.mdx` but is not referenced in `docs.yml`. The v2 URL is already redirected to `/trading/trading-fees` via a `docs.yml` redirect, so the file is unreachable. A previous deletion of this file was reverted by the team, so leave it in place; just do not use it as canonical content.

## Last updated
2026-04-22
