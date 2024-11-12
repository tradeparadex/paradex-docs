# ETH-USD-PERP

## Contract Specifications

<table><thead><tr><th width="375.91797556719024">Features</th><th>Value</th></tr></thead><tbody><tr><td>Product Type</td><td>Linear Perpetual Future</td></tr><tr><td>Settlement Currency</td><td>USDC</td></tr><tr><td>Base Currency</td><td>ETH</td></tr><tr><td>Quote Currency</td><td>USD</td></tr><tr><td>Price Tick Size</td><td>0.01 USD</td></tr><tr><td>Order Size Increment</td><td>0.001 ETH</td></tr><tr><td>Minimum Order Value</td><td>100 USD</td></tr><tr><td>Maximum Order Size</td><td>1,000 ETH</td></tr><tr><td>Maximum Number of Open Orders</td><td>100</td></tr><tr><td>Position Limit</td><td>2,000 ETH</td></tr><tr><td><a href="https://docs.paradex.trade/risk-system/price-bands">Price Band Factor</a></td><td>2%</td></tr><tr><td>Funding Clamping Rate</td><td>2%</td></tr></tbody></table>

## Mark Price Parameters

<table><thead><tr><th width="375">Parameter</th><th>Value</th></tr></thead><tbody><tr><td><a href="../../../risk-system/mark-price-calculation.md#funding-rate-formula">EWMA Factor</a></td><td>20%</td></tr></tbody></table>

## [Cross Margin Parameters](../../../risk-system/cross-margin-requirement.md#margin-fractions)

| Parameter      | Value    |
| -------------- | -------- |
| Base IMF[^1]   | 2%       |
| IMF[^2] Factor | 0.000034 |
| IMF[^3] Shift  | 44,000   |
| MMF[^4] Factor | 50%      |

IMF = Initial Margin Fraction

MMF = Maintenance Margin Fraction

[^1]: Initial Margin Fraction

[^2]: Initial Margin Fraction

[^3]: Initial Margin Fraction

[^4]: Maintenance Margin Fraction
