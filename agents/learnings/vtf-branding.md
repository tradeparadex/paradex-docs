# VTF branding

## Context

As of v1.143 (April 2025), Vaults have been rebranded to Vault Traded Funds (VTFs). All user facing documentation should use "VTF" or "Vault Traded Funds (VTFs)" terminology instead of "Vaults".

## Where VTF content lives

| Location | Purpose |
|---|---|
| `fern/pages/vaults/introduction.mdx` | VTF overview, benefits for depositors and operators |
| `fern/pages/vaults/key-features.mdx` | Feature descriptions: VTF types (DIME, Verified Operator, Community), multi asset strategies, portfolio margin, LP tokens, order privacy, withdrawals, configurable params |
| `fern/pages/vaults/faqs.mdx` | Frequently asked questions |
| `fern/pages/vaults/tutorials/` | How to guides (create, deposit, withdraw, close) |
| `fern/docs.yml` | Top level "VTFs" tab (between Risk & Liquidations and Paradex Chain) |

## VTF types

- **DIME VTFs**: Operated by Paradex (protocol managed)
- **Verified Operator VTFs**: Run by vetted, approved third party operators
- **Community VTFs**: Fully permissionless, anyone can create one

## Gotchas

- VTFs have their own top level tab at `/vtfs/`. Old URLs under `/docs/vaults/` redirect to `/vtfs/`.
- The folder path remains `fern/pages/vaults/` for file organization. Do not rename the folder.
- Asset images in `fern/assets/vaults/` still use `vault_` prefixed filenames. These are screenshot files and do not need renaming.
- API endpoint names in the MCP docs (`paradex_vaults`, `paradex_vault_balance`, etc.) use the original naming. These reflect actual API identifiers and should not be renamed in docs.
- Historical references in release notes and past roadmap sections should not be updated (they are records of what happened at that time).
- Profit share range is 0% to 30% (not the old 0% to 20%).

## Last updated

2026-06-04
