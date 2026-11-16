# Fern CLI version

## Patterns

- The Fern CLI version is pinned in `fern/fern.config.json`. Fern CLI 5.215.0 and later refuses to run a pinned version older than 5.215.0, so `fern check` and `fern generate` fail in CI until the pin is bumped.
- Upgrade with `cd fern && npx fern-api@latest upgrade -y`. The `-y` flag accepts the migration prompt non-interactively.
- The 4.45.0 to 5.x upgrade added `disambiguate-request-names: false` to `fern/apis/prod_rest/generators.yml` and `fern/apis/testnet_rest/generators.yml`, which keeps existing request wrapper names.
- Locally, `fern check --warnings` reports one "Missing redirects check skipped: not authenticated" warning without `FERN_TOKEN`. That is expected.

## Last updated

2026-11-16
