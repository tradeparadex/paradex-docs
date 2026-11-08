# Session keys and passkeys

## Where it is documented

The REST API tab has a "Session Keys" section (`fern/pages/developer-portal/session-keys/`):

| Page | Covers |
|---|---|
| `overview.mdx` | What a session key is, when to use it vs subkeys and readonly tokens |
| `create-a-session.mdx` | `SessionGrant` fields, EIP-712 and SNIP-12 typed data, grant id, `POST /v2/sessions`, signing in |
| `manage-sessions.mdx` | List, get, revoke, revoke all, unauthenticated status |
| `passkeys.mdx` | Challenge, `PasskeyGrant`, `SessionMint`, list and revoke passkeys |
| `scopes.mdx` | Scope per private route |
| `sdk-examples.mdx` | paradex.js and paradex-py session APIs |

## Gotchas
- The `/v2/sessions` and `/v2/passkeys` routes were not in the synced OpenAPI spec when these pages were written, so the pages carry the request and response reference themselves. Once the spec includes them, link to the generated reference instead of duplicating it.
- The server does not enforce session limits yet: every limit must be `"none"` and `markets` `["*"]`, and builder grants are refused. Do not document limits as enforced until the server enforces them.
- Public docs only: no internal service names, flag names or rollout plans. Rollout gating is described only as "access may be limited during rollout" (`SESSIONS_DISABLED`, `PASSKEYS_DISABLED`).
- Hard lifetime caps are documented on purpose: 30 day grants, 7 days with `trade:block` or `account:settings`, 32 subaccounts, and for passkeys 7 day sessions, 5 concurrent sessions and 180 days. "No limits" refers only to trading limits.
- RFQ create, execute and draft routes refuse session JWTs at the handler, while RFQ reads and delete work with `trade:rfq`. Block trade writes are owner only, so `trade:block` grants nothing yet. Describe this as today's behavior without promising a change, and keep it out of "What a session can never do".
- A session key must sign in through `POST /v1/auth/{public_key}`. Without the key in the path the server verifies against the main key. The signed expiration must be within 15 minutes of the timestamp.
- Passkeys are documented as first party only, as a current limitation.
- The server refuses every listed subaccount today because nothing creates eligible children yet, so examples must not list subaccounts even though both SDKs accept them.
- SNIP-12 grants are signed with integer fields as decimal strings, but the request body must carry them as JSON integers.
- `||` inside a Markdown table splits the row, even within a code span.

## Source of truth
Check the server repo's route scope table, grant validation code and endpoint descriptions. Do not name server paths or services in this repo.

## Last updated
2026-11-08
