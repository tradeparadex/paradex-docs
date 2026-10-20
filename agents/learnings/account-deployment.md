# Account deployment

## Where it is documented

New main accounts are not deployed on chain at onboarding; their first credit (a deposit through any bridge, or an incoming transfer) deploys them. The canonical explanation is the `## Account deployment` section of `fern/pages/introduction/architecture-overview/wallet-integration.mdx` (anchor `/docs/accounts/wallet-integration#account-deployment`). Short notes link to it from:

| Location | Note |
|---|---|
| `fern/pages/accounts/overview.mdx` | First deposit or transfer deploys a new account |
| `fern/pages/accounts/sub-accounts.mdx` | Fund the main account first; API returns `400 INVALID_PARENT_ACCOUNT` |
| `fern/pages/accounts/transfers.mdx` | Transfers to an account not yet deployed are allowed |
| `fern/pages/developer-portal/general-information/api-authentication.mdx` | Note after EVM onboarding, covers `/v1` and `/v2` onboarding |
| `fern/pages/developer-portal/general-information/api-quick-start.mdx` | Fund before trading or creating sub-accounts |

## Gotchas
- Exceptions that still deploy at onboarding: portfolio margin accounts and accounts on the legacy proxy account class.
- The `POST /onboarding` description in the REST reference comes from the synced OpenAPI spec. Change it in the API source, not in `openapi.json`.
- Vale flags the past tense of "onboard" as a spelling error; reword around it.
- `fern check` fails on a missing `fern/assets/vendor-cookieconsent.bundle.js` until `yarn install` has run (its install hook generates the file).

## Last updated
2026-10-20
