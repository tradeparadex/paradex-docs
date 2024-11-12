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

# 📱 API

## Public Endpoints

The rate limit for all of our public API endpoints is set to a maximum of 200 requests per second or 1500 requests per minute per IP address.

Exceptions:

* `POST /onboarding` & `POST /auth`: These endpoints have a shared rate limit of _<mark style="color:blue;">50 requests per second or 600 requests per minute</mark>_ per IP address.

## Private Endpoints (Per-account limits)

For our private API endpoints, the rate limit varies according to the specific endpoint:

* `POST /orders` & `DELETE /orders`: These endpoints have a shared rate limit of _<mark style="color:blue;">800 requests per second or 15000 requests per minute</mark>_ per account.
* `GET /*`: All GET endpoints have a shared rate limit of _<mark style="color:blue;">40 requests per second or 600 requests per minute</mark>_ per account.

For private end points the rate limits are per account and not per IP.
