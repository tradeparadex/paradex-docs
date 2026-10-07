# Perpetual instrument spec pages

## Sourcing values

- When no internal admin JSON is provided, `curl -s "https://api.prod.paradex.trade/v1/markets?market=<SYMBOL>"` gives every field except the per-market EWMA factor (`oracle_ewma_alpha`). The public `oracle_ewma_factor` is unrelated, so don't use it. AERO-USD-PERP's public value was ~0.067, not the ~3.2% the skill describes, so it isn't even constant across markets.
- If `oracle_ewma_alpha` is missing, flag `ewmaFactor` for confirmation in the PR. Tier-2 pages currently use 14%, 15%, 20% or 3%. The most recent listings (GRAM, VVV) use 14%.
- `delta1_cross_margin_params.imf_base` is the public API's equivalent of `cross_margin_params.imf_base`.

## Log

- 2026-10-07: AERO-USD-PERP added to tier-2 from the public API. `ewmaFactor` is 19%, from DB `oracle_ewma_alpha` 0.81196832 (1 − 0.812 = 18.8%, rounded). The first draft guessed 14%, so ask for the DB value before guessing.
