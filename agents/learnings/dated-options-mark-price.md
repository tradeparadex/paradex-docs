# Dated options Mark Price page

Page: `fern/pages/dated-options/mark-price.mdx`

## Mark IV

- Mark IV is calculated directly by fitting the implied volatility surface from a reference exchange. It is no longer a median blend of internal (bid/ask/last/mid) and external variance EWMAs.
- Reference exchange per underlying: BTC -> Deribit, ETH -> Deribit, HYPE -> Derive.

## Other inputs

- Pricing uses the Black-76 model off a synthetic forward $F = S \times e^{fT}$.
- The annualized forward rate $f$ is calibrated externally from Deribit per expiry.
- The risk-free rate $r$ is a separate discounting parameter, currently 0%.

## Last updated

2026-07-09
