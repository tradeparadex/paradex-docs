# WebSocket SBE

## Facts
- As of 21 September 2026, SBE is required for public WebSocket channel payloads. JSON is no longer served for public channels.
- Enable via `?sbeSchemaId=1&sbeSchemaVersion=1` on the WebSocket URL, or `sbe_enabled=True` in paradex-py (v0.7.0+).
- JSON-RPC control messages (subscribe, unsubscribe, auth, responses) and private channel payloads remain JSON.

## Patterns
- The enforcement notice is a `<Warning>` callout at the top of `websockets/landing.mdx`, `websockets/introduction.mdx` and `websockets/binary-encoding-sbe.mdx`. Do not describe SBE as optional anywhere in the WebSocket docs.

## Last updated
2026-09-21
