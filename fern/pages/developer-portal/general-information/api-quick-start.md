---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# ⚡ API Quick start

## Calling a public endpoint

To dive right in you can start by trying a call to one of Paradex's public endpoints, [`GET /markets`](https://docs.api.prod.paradex.trade/#list-available-markets) :&#x20;

{% swagger src="https://api.testnet.paradex.trade/swagger/doc.yaml" path="/markets" method="get" %}
[https://api.testnet.paradex.trade/swagger/doc.yaml](https://api.testnet.paradex.trade/swagger/doc.yaml)
{% endswagger %}

## Interacting with private endpoint

To interact with private Paradex endpoints you need to onboard and generate a [JSON Web Token (JWT)](https://jwt.io/introduction) before making API requests. JWTs are a secure way to transmit information between parties. Please refer to the **Authentication** chapter and [onboarding and authentication code samples](https://github.com/tradeparadex/code-samples).
