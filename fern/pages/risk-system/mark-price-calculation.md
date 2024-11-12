# 💱 Mark Price Calculation

## **Perpetual Mark Price Formula**

The mark price of a perpetual future instrument is calculated as :

$$
\text{Mark Price}=\text{Spot Oracle Price}*(1+\text{Fair Basis})
$$

where :

$$\text{Spot Oracle Price}$$ is an external oracle price of the underlying coin obtained via the [Pyth Network](https://pyth.network/price-feeds).

The Fair Basis is calculated as the median of three components:

* median between the EWMA of 3 rates implied from the best bid, best ask and last price
* EWMA of implied the Mid Rate
* median of External Rates

$$
\text{Fair Basis}=\text{median}\big(\text{median(Paradex EWMA rates)}, \text{Mid Rate EWMA, median(External Rates)})
$$

More details are provided below:&#x20;

## **Steps to calculate the Fair Basis and the Mark Price**

### 1. Every 5 seconds, get the latest Best Ask, Best Bid, Last Trade and Spot Prices

<figure><img src="../.gitbook/assets/Screenshot 2024-07-04 at 11.24.42.png" alt=""><figcaption><p>Example with SOL-USD-PERP best bid, best ask, last trade price and spot price</p></figcaption></figure>

### 2. Calculate the implied rates from Best Ask, Best Bid, Last Trade relative to the Spot Price

<figure><img src="../.gitbook/assets/Screenshot 2024-07-04 at 11.24.53.png" alt=""><figcaption><p>Rates implied from SOL-USD-PERP best bid, best ask and last trade price relative to the spot price</p></figcaption></figure>

### 3. Calculate the EWMA **(Exponentially Weighted Moving Average) of each of the three rates (**Paradex EWMA rates) **and take the median**

In this example, an EWMA weight of 20% is applied to the latest rate observation

<figure><img src="../.gitbook/assets/Screenshot 2024-07-04 at 11.25.00.png" alt=""><figcaption><p>EWMA of SOL-USD-PERP rates implied from best bid, best ask and last trade price relative to the spot price</p></figcaption></figure>

### 5. Calculate the EWMA **(Exponentially Weighted Moving Average) of the Mid Rate**

The **Mid Rate EWMA** is calculated from the implied rate of the Mid Price relative to the Spot Price, where Mid Price is calculated as:

$$
\text{Mid Price}=\frac{\big(\text{Best Ask} + \text{Best Bid}\big)}{2}
$$

### 6. Calculate the median of the External Rates

The **External Rates** are determined from Mark Prices and Index Prices fetched from external exchanges (actually, Bybit, Binance and OKX) and calculated as:

$$
\text{External Rate}=\big(\frac{\text{Mark Price}}{\text{Index Price}} -1\big) * \frac{\text{Paradex Funding Interval}}{\text{Exchange Funding Interval}}
$$

Where Paradex Funding Interval is actually 8h for all instruments

### 7. Calculate the Fair Basis

Finally, the **Fair Basis** is calculated as the median of the three components

$$
\text{Fair Basis}=\text{median}\big(\text{Paradex EWMA rates}, \text{Mid Rate EWMA, median(External Rates)})
$$

### 8. Calculate the Mark Price by applying the Fair Basis to the Spot Price

<figure><img src="../.gitbook/assets/Screenshot 2024-07-04 at 11.27.53.png" alt=""><figcaption><p>SOL-USD-PERP mark price compared to the underlying spot price</p></figcaption></figure>

Note that the **Fair Basis** is different from the **Funding Rate**, the Funding Rate is derived from the Fair Basis using the formula [described here](funding-mechanism.md#funding-rate)&#x20;

Here a comparison between the Fair Basis and the Funding Rate in this example :&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2024-07-04 at 11.36.04.png" alt=""><figcaption><p>SOL-USD-PERP fair basis and funding rate</p></figcaption></figure>