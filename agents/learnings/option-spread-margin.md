# Option spread margin

Page: `fern/pages/dated-options/margin-requirements.mdx`

## Patterns

- Option spread margin is a subsection (`###`) of `## Cross margin`, placed after Cross margin parameters. Its subsections use `####`.
- Formula: `Group Margin = min(Sum of Isolated Margins, Max Settlement Loss + Unpaired Short Call Reserve)`; grouping can only lower a requirement.
- Grouping applies only to dated options on the same underlying and expiry with at least one short leg. Open orders count at IMR only.
- `Unpaired Scale` is independent of underlying (IMR 1.2, MMR 1.0), so its table is a single table with no per-asset `<Tabs>`.

## Last updated

2026-09-15
