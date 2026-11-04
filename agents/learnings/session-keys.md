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
- RFQ routes declare `trade:rfq` but refuse session JWTs at the handler for now; block trade writes are owner only, so `trade:block` grants nothing yet.

## Source of truth
- Route scopes: `api/paradex/web-api/server/route_scopes.go` in the server repo.
- Grant schema and validation: `api/paradex/pkg/sessiongrant/`.
- Endpoint descriptions: `api/paradex/web-api/docs/sessions-create.md`, `passkeys-*.md`.

## Last updated
2026-11-02
