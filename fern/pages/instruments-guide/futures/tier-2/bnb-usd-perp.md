# BNB-USD-PERP

## Contract Specifications

<table><thead><tr><th width="375.91797556719024">Features</th><th>Value</th></tr></thead><tbody><tr><td>Product Type</td><td>Linear Perpetual Future</td></tr><tr><td>Settlement Currency</td><td>USDC</td></tr><tr><td>Base Currency</td><td>BNB</td></tr><tr><td>Quote Currency</td><td>USD</td></tr><tr><td>Price Tick Size</td><td>0.001 USD</td></tr><tr><td>Order Size Increment</td><td>0.01 BNB</td></tr><tr><td>Minimum Order Value</td><td>50 USD</td></tr><tr><td>Maximum Order Size</td><td>1,700 BNB</td></tr><tr><td>Maximum Number of Open Orders</td><td>50</td></tr><tr><td>Position Limit</td><td>5,000 BNB</td></tr><tr><td><a href="https://docs.paradex.trade/risk-system/price-bands">Price Band Factor</a></td><td>5%</td></tr><tr><td>Funding Clamping Rate</td><td>5%</td></tr></tbody></table>

## Mark Price Parameters

<table><thead><tr><th width="375">Parameter</th><th>Value</th></tr></thead><tbody><tr><td><a href="../../../risk-system/mark-price-calculation.md#funding-rate-formula">EWMA Factor</a></td><td>20%</td></tr></tbody></table>

## [Cross Margin Parameters](../../../risk-system/cross-margin-requirement.md#margin-fractions)

| Parameter      | Value |
| -------------- | ----- |
| IMF[^1]        | 5%    |
| MMF[^2] Factor | 50%   |

IMF = Initial Margin Fraction

MMF = Maintenance Margin Fraction

[^1]: Initial Margin Fraction

[^2]: Maintenance Margin Fraction
