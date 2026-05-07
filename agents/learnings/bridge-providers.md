# Bridge providers

## Where bridge providers are referenced

Cross-chain bridge partners (Layerswap, Hyperlane, Orbiter Finance, etc.) are mentioned in several places. When a partner is added, removed, or deprecated, update **all** of the following so the docs stay consistent:

| Location | Purpose |
|---|---|
| `fern/pages/introduction/bridges-onramps.mdx` | Canonical partner page: chain support matrix, deposit/withdrawal availability, integration status table, per-partner accordion, and partner documentation links |
| `fern/pages/accounts/overview.mdx` | Cross-Chain Bridge section listing partner names |
| `fern/pages/accounts/deposits-and-withdrawals/cross-chain-bridging.mdx` | Step-by-step deposit/withdrawal flows referencing example bridge providers |
| `fern/pages/ecosystem/overview.mdx` | Cross-Chain Bridges card description |
| `fern/docs.yml` | Ecosystem → Cross Chain Bridges section: external `link:` entries |

## Gotchas

- `fern/apis/prod_ws/asyncapi-2.6.0.yaml` contains a `bridge` enum (e.g. `STARKGATE`, `LAYERSWAP`, `RHINOFI`, `HYPERLANE`). This file is auto-synced from the live API by `.github/workflows/sync-openapi.yml` (Mon–Fri). Do not hand-edit enum values to remove a deprecated bridge — wait for the API to drop the enum value and let the sync workflow propagate it.
- `fern/pages/release-notes/*` and the historical sections of `fern/pages/introduction/roadmap.mdx` (e.g. "2024 Achievements", past quarter cards) are historical records. Do **not** rewrite them when deprecating a partner; only forward-looking content should be updated.
- The chain support matrix in `bridges-onramps.mdx` is a markdown table. When removing a provider, drop the column from the header, the alignment row, **and** every data row — easy to miss one.

## Patterns

- When deprecating a provider, prefer outright removal from active user-facing docs over leaving stale "deprecated" notices, unless the user explicitly asks for a deprecation banner.
- Keep partner lists in roughly the same order across files (matrix column order, accordion order, integration table order) to make diffs easy to review.

## Last updated

2026-05-07
