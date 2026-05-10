# Roadmap page conventions

The roadmap page lives at `fern/pages/introduction/roadmap.mdx` and uses `<Tabs>` with one tab per year and `<CardGroup cols={3}>` per quarter, with one `<Card>` per month.

## Monthly card format

Each monthly card uses bolded section headings and bulleted lists. Sections are separated by two blank lines. Indentation is:

- 6 spaces before `<Card>`
- 8 spaces before `**Section Heading**`
- 10 spaces before list items (`- `)

Standard category names (in this order when used):

1. `**New Markets**` — perpetual or spot market launches, NFT launches
2. `**Liquidity & Trading**` — trading mechanics, order behavior, fees, programs
3. `**Performance & Infra**` — API additions, latency, infra upgrades
4. `**UX**` — UI redesigns, new themes, builder improvements, mobile

Recent monthly cards typically include 2–3 categories with 2–6 bullets each. Keep bullets concise (3–8 words each) and high-signal — collapse small related changes into a single bullet.

## Mapping release notes to roadmap entries

Source release notes for a given month live at `fern/pages/release-notes/v1.<n>.md`. Each `vX` file covers ~1 week, so a month spans 4–5 versions. Group the prod release-note bullets by theme, then condense into the roadmap card bullets:

- 🖥️ UI Updates → `**UX**`
- ⚙️ API Updates → `**Performance & Infra**`
- New perpetual markets / NFT launches → `**New Markets**`

Example: March 2026 (v1.135–v1.139) had no new markets, so the card uses just `**Performance & Infra**` and `**UX**` (2 categories, both well under the 4-category cap).

Example: April 2026 (v1.139.2–v1.143.6) had no new markets but introduced DIME fee programs, a new portfolio-margin order slider, and several API additions, so the card uses `**Liquidity & Trading**`, `**Performance & Infra**`, and `**UX**` (3 categories).

## Quarter headings

Use `### YYYY QN` headings inside each year's `<Tab>` (e.g. `### 2026 Q1`, `### 2026 Q2`). Add the next quarter heading the first time a month in that quarter is added — keep one `<CardGroup cols={3}>` per quarter, with monthly `<Card>` entries inside it.

Quarters are listed in **descending order** (most recent first) within each year's tab, matching the pattern used for past years (e.g. 2025 shows Q4, then Q3, then Q2, then Q1). When adding a new quarter, insert its heading and `<CardGroup>` above the previous quarter.

## Last updated

2026-05-10
