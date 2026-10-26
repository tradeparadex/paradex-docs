# WebSocket error codes and rate limits

Pages: `fern/pages/websockets/error-handling.mdx`, `fern/pages/websockets/rate-limits.mdx`

## Gotchas

- Error codes are defined in mono `api/paradex/websocket-api/wsrpc/error.go`, close codes in `wsrpc/close_codes.go`. Document only codes the server actually sends: `100` (Method error) is defined but never sent, and close codes 4029, 4030 and 4033 are defined but unused.
- `42901` reads "message rate limit exceeded" but is the per account order rate limit on `order.*` methods. The per connection message limit delays messages instead of rejecting them, and authenticated `order.*` requests are exempt from it.
- WebSocket order limits are separate from, and lower than, the REST order limits on `developer-portal/general-information/rate-limits/api.mdx`. Prod values live in mono `infra/helm/paradex/environments/prod-backend.yaml` under `websocket-api` (`RATE_LIMIT_ORDERS_BY_ACCOUNT*`). The 1500 req/m IP cap is REST only.
- REST order requests count toward the WebSocket order limit. Describe this as behavior only; do not describe how the counting is implemented.
- Interactive (Retail) tokens get an extra per account limit on `order.create`, `order.create_batch` and `order.modify` (`RATE_LIMIT_ORDERS_BY_ACCOUNT_*_INTERACTIVE` under `websocket-api`). Over WebSocket it rejects with 42901; it does not switch to Pro behavior as REST does. `order.cancel_on_disconnect` is not rate limited.
- Each connection dispatches messages one at a time, so exempt `order.*` requests still wait behind messages the message limit is delaying, and a burst of exempt requests can still fill the inbound queue (4032).
- The server also closes with standard 1001 (going away) on shutdown and slow consumers; the close codes table lists only the Paradex range.
- A connection with no subscriptions for 5 minutes is closed with 4031, which affects connections used only for order entry.

## Last updated

2026-10-26
