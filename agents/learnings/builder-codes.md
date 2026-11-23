# Builder Codes pages

Pages live in `fern/pages/builder-codes/` and sit in the REST API tab under a `Builder Codes` section (`/api/builder-codes/...`): Overview, Builder Approvals, Attaching a Builder to Orders, Stats and Leaderboard.

## Gotchas

- The builder fields, the approval endpoints and session grants are not in the synced OpenAPI/AsyncAPI specs, so the pages document them inline (like the MMP page). Link out once the specs include them.
- `builder_fee_rate` is a decimal fraction of notional (`"0.0005"` = 5 bps), never bps. In signatures it is scaled by 10^8 (`"0.0005"` signs as `50000`).
- Caps per market kind are set on chain by Paradex and can change, so the docs give no numbers. A rate over the cap is rejected, not clamped. The approval ceiling is at most `0.01` (100 bps).
- An order with a builder is signed as `BuilderOrder` (the `Order` fields plus `builder`, `builderFeeRate`).
- A bad order signature returns 400 `VALIDATION_ERROR`, not 401.
- Revoking a session does not revoke its builder approval, and the approval cannot outlive the grant's `expiresAt`.
- Two approval routes: the session grant `builder` member, and the standalone `POST /v2/builders/approvals` (EIP-712 `BuilderApproval`, no JWT, no session limits, expiry required and at most 180 days). A standalone approval with an expiry over 180 days returns `LIMIT_INVALID`; a Stark owner gets `INVALID_SIGNATURE` there but `ACCOUNT_NOT_ELIGIBLE` on the grant route.
- Do not describe fee splits, feature flags or internal service names.
- Planned behavior that has not shipped carries an MDX comment, `{/* TODO: ... */}`, at the top of its section. The comment does not render, but the repo is public, so it names no tickets, flags or internal systems. Remove each one when the behavior ships.
- Stats report `fees_paid` (what traders paid the builder). A window with fewer than 3 paying users reads as zeros, and the leaderboard ranks only builders with at least 3.
- Vale flags "onboarded", "undercollateralized" and "underlying's"; reword around them.

## Last updated
2026-11-23
