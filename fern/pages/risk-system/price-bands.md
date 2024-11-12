# 💲 Price Bands

Price bands restricts the execution of aggressive orders to some bandwidth that contains the Mark Price. Any instrument will have dynamic **Limit down price** and **Limit up price**.

The price band for a perpetual future market is centered around the Mark Price according to a **% bandwidth parameter**.

> **Example :**
>
> * Bandwidth parameter = 5%
> * Mark price = $100
>
> → **Limit down price** = $95 and **Limit up price** = $105
>
> * A limit sell order at $94 is rejected
> * A “passive” limit buy order at $90 is **NOT** rejected
> * A market buy order is assigned a limit price = $105. Any quantity that is not immediately filled is rejected