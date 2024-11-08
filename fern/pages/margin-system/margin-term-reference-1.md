# Margin Term Reference

## **Setup**

A portfolio of :

* Balances in $$n$$ tokens $$\{T_1,...,T_n\}$$
* Positions in $$m$$ derivative assets $$\{D_1,...,D_m\}$$

## **Definitions**

### _**Position Notional (USD)**_ :

Theoretical worth of a position in a derivative asset $$D$$ in USD terms :

$$
\text{Position Notional}(D)=\text{Position Size}(D)*\text{Mark Price}(D)
$$

### _**Collateral Value (USD)**_

This is the value of all tokens on account **in USD terms**.

$$
\text{Total Collateral Value}=\text{USDC Balance}*\text{USDC Oracle Price}
$$

### _**Position Cost (USDC)**_

Only applies to synthetic balances. Represents the position entry cost - amount of USDC that account paid/received from entering the position. Updated on every trade that account executes in this position. The cost is constant in USDC terms between trades.

* **Example 1 :** long position of 1 ETH-USD-PERP bought at $2,000 with USDC/USD=1 has position cost of 2,000 USDC.
* **Example 2 :** short position of 1 ETH-USD-PERP sold at $2,000 with USDC/USD=0.8 has position cost of -2,500 USDC.

### _**Unrealized PnL (USD)**_&#x20;

Determines how much money an account will receive if open positions are closed at oracle price

$$
\text{Unrealized PnL}=\sum\limits_{j=1}^{m} \bigg(\text{Position Notional}(D_j)-\text{Position Cost}(D_j)*\text{USDC Oracle Price}\\+\text{Funding PnL}\bigg)
$$

### _**Account Value (USD)**_

Also called margin balance. This value is a key component in margin checks and represents the account’s token assets value in USD if we close all open positions at their mark (fair) price.

$$
\text{Account Value}=\text{Collateral Value}+\text{Unrealized PnL}+\text{Funding PnL}
$$

### _**Margin Requirement**_

*   _**Account Initial Margin Requirement (USD) -**_ When submitting a new order, the account is subject to a minimum value defined by the initial margin requirement. Note that the cloud and the chain calculate different initial margin requirements for an account :

    * Account IMR (including open orders) - This is calculated off-chain (on cloud) and incorporates both open positions and open/pending orders.&#x20;
    * Position IMR (only including open positions) - This is calculated on-chain for validation of incoming trades.

    Note that the Account IMR calculated off-chain is more conservative than the Position IMR. Therefore, orders submitted from the cloud to the chain are very unlikely to be rejected.
* _**Account Maintenance Margin Requirement (USD)**_ - The MMR is the minimum account value required for the account not to be liquidated

_Note :_ Calculation of IMR and IMR in a cross-margin account can be found in the [Cross Margin Requirement](cross-margin-requirement.md) page

### _**Free Collateral Balance (USD)**_

The USD value of the collateral that can be immediately withdrawn

$$
\text{Free Collateral Balance}=\text{Account Value}-\text{Account Initial Margin Requirement}
$$

### _**(Accrued) Funding PnL (USD)**_

This refers to the unrealized Funding _accrued on open perpetual positions since account’s last trade in those positions_. When the account executes a trade in an existing open perpetual position, any accrued funding on this position is realized (i.e. account’s USDC balance is updated) and Funding PnL of this position is reset to 0. For more details on funding mechanism, please refer to the [Funding Mechanism](../the-basics/funding-mechanism.md) page

### _**Health Factor (%)**_

This ratio compares the account value to the maintenance margin requirement. If the factor is below 1, the user account is under liquidation mode.

$$
\text{Health Factor}=\frac{\text{Account Value}}{\text{Maintenance Margin Requirement}}
$$
