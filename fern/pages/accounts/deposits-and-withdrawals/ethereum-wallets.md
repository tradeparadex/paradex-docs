---
description: Detailed guide for depositing and withdrawing funds to / from Paradex
---

# 🔶 Ethereum Wallets

{% hint style="info" %}
**Note:** Paradex has launched 1-step deposits on 28 May 2024. Users will be able to seamlessly transfer funds from L1 to Paradex without needing the additional step of transferring between the Paradex bridge contract and Paradex.
{% endhint %}

## <mark style="color:purple;">Deposits</mark>

Deposits are a single-step process. Initiate a deposit from your Ethereum wallet to the Starknet bridge and it will automatically be sent to Paraclear. These transactions may take several minutes depending on network conditions.

<figure><img src="../../.gitbook/assets/Paradex-Deposit-Flow.png" alt=""><figcaption></figcaption></figure>

#### <mark style="color:purple;">**Step 1: Initiate a Deposit to the Paradex Bridge**</mark>

1. Navigate to the **“**[**Portfolio**](https://app.paradex.trade/portfolio)**”** tab in the webapp and connect your wallet (MetaMask or other supported wallet)
2. Click the <mark style="color:purple;">**“Deposit”**</mark> button and enter the amount of funds you wish to transfer to Paradex.

{% hint style="info" %}
Note: This action will require 1-2 L1 signatures. If this is your first deposit to Paradex you will need to enable ERC-20 token transfers and set a spending cap for USDC to the Paradex bridge. If you already have an allowed spending limit set for this token, you can skip this step.
{% endhint %}

3. Confirm the transaction in MetaMask to send USDC to the Paradex bridge contract by selecting <mark style="color:purple;">**“Initiate Deposit to Bridge”.**</mark>
4. Wait for L1 Confirmation:
   * Wait for the L1 deposit transaction to be confirmed on the Ethereum blockchain. This may take a few minutes depending on network conditions.
   * Once confirmed, your funds will automatically be sent from the bridge to Paraclear
5. Start Trading!

## <mark style="color:purple;">Withdrawals</mark>

Paradex has a **two step withdrawal** process which entails:

1. <mark style="color:purple;">**Transferring funds from Paradex to the Paradex bridge contract to**</mark> (requires L2 blockchain signature).
2. <mark style="color:purple;">**Transferring funds from the Paradex bridge contract to your Ethereum wallet**</mark> (requires L1 blockchain signature).

<figure><img src="../../.gitbook/assets/Paradex-Withdraw-Flow.png" alt=""><figcaption></figcaption></figure>

#### <mark style="color:purple;">**Step 1: Initiate a Withdrawal to the Paradex Bridge**</mark>

1. Navigate to the **“**[**Portfolio**](https://app.paradex.trade/portfolio)**”** tab in the webapp and connect your wallet (MetaMask or other supported wallet)
2. Click the <mark style="color:purple;">**“Withdraw”**</mark> button and enter the amount of funds you wish to transfer from Paradex.
3. Click <mark style="color:purple;">**“Initiate Withdrawal to Bridge”**</mark>.

#### <mark style="color:purple;">**Step 2: Transfer Funds from the Paradex Bridge to Wallet**</mark>

4. Wait for L1 Confirmation:
   * Wait for the L1 withdrawal transaction to be confirmed on the Ethereum blockchain. Once confirmed, the deposit status will update to <mark style="color:purple;">**“Available - L1”**</mark> in the “Deposit / Withdrawals” table.

{% hint style="info" %}
Note: “Pending - L2'' status can take up to 16 hours to update.

Withdrawing funds requires all preceding actions from all accounts (including risk checks) be validated on Ethereum (L1). Your Paradex (L2) withdrawal transaction will be batched along with other Paradex (L2) transactions (trades, deposits, withdrawals, etc) and sent to the Starknet Prover to generate a Proof guaranteeing the calculations. Batching and proving can take several hours depending on the volume of trades / transactions processed by Paradex (L2) and generating a Starknet proof takes around 2 hours. Once the proof is generated it is sent to the Starknet (L1) verifier contract which will confirm its validity and then unlock funds for withdrawal.
{% endhint %}

5. Transfer to Wallet:
   * Click the <mark style="color:purple;">**“Withdraw to Wallet”**</mark> button in the “Actions” section to complete the transfer of your funds from the bridge to your wallet. This may take a few minutes depending on Ethereum network conditions.
6. Withdrawal complete!