# 🛑 Self Trade Prevention

The implementation of our Self-Trade Prevention (STP) feature enables users trading all instruments via API to configure an STP parameter for their orders. This feature effectively mitigates unintentional self-trading as **self-trading through the same account is not possible**. \
\
With this parameter, users have the flexibility to determine the outcome in case of a self-trade, whether to expire the maker order, the taker order, or both orders.

## Self-Trade Prevention Function for API Users

There are three distinct modes for the STP function, more details

1. EXPIRE\_MAKER : close the resting order
2. EXPIRE\_TAKER (Default): close the aggressive order
3. EXPIRE\_BOTH : close both

More details on how to use STP function, please refer to [API doc](https://docs.api.testnet.paradex.trade/#get-open-orders)