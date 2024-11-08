# 👩‍💻 Placing Orders

## Order Parameters

#### **Price Tick Size**

* This is the smallest increment by which the price of an instrument can change.&#x20;

#### **Order Size Increment**

* This refers to the minimum step by which the quantity of an order can increase or decrease.&#x20;
* Order Size Increment is specified in the instrument's Base Currency.

#### **Minimum Order Value**

* This is the smallest order USD value allowed to be placed on the order book. This helps to increase our average trade value to ensure gas fee efficiency when processing trades.&#x20;
* The value of an order is calculated by multiplying the order size by the mark price.
* Order Size Increment is specified in USD.
* **Exception:** A user may place a [Reduce-only Order](order-instructions.md#reduce-only) that is below the Minimum Order Value if its matches the size of an offsetting position.

#### **Maximum Order Size**

* The largest number of contracts that one can buy or sell in a single order.&#x20;

#### **Maximum Number of Open Orders**

* This is a cap on the number of open orders a trader can have at one time.

## Order Types

You may create the following Order Types on Paradex

<table data-view="cards"><thead><tr><th data-card-target data-type="content-ref"></th><th data-hidden data-card-cover data-type="files"></th></tr></thead><tbody><tr><td><a href="../../trading/placing-orders/order-types/limit-order.md">limit-order.md</a></td><td></td></tr><tr><td><a href="../../trading/placing-orders/order-types/market-order.md">market-order.md</a></td><td></td></tr><tr><td><a href="../../trading/placing-orders/order-types/stop-orders.md">stop-orders.md</a></td><td></td></tr><tr><td><a href="../../trading/placing-orders/order-types/scaled-order.md">scaled-order.md</a></td><td></td></tr><tr><td><a href="../../trading/placing-orders/order-types/twap-order.md">twap-order.md</a></td><td></td></tr></tbody></table>

***

## Order Instructions

The following order instructions are supported for the orders that you wish to place.

<table data-view="cards"><thead><tr><th data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><a href="order-instructions.md#post-only">#post-only</a></td></tr><tr><td><a href="order-instructions.md#reduce-only">#reduce-only</a></td></tr><tr><td><a href="order-instructions.md#good-till-cancelled-gtc">#good-till-cancelled-gtc</a></td></tr><tr><td><a href="order-instructions.md#immediate-or-cancel-ioc">#immediate-or-cancel-ioc</a></td></tr></tbody></table>
