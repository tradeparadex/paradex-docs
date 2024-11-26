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

# 🌏 Global IP Addresses

Paradex API leverages AWS Global Accelerator to route traffic to our infrastructure in Tokyo. It provides us with static IP addresses that are geographically distributed across the AWS global network.

These IP addresses may appear to be located in the US by some DNS lookup tools due to AWS being a US-based company. However, the actual path your traffic takes prioritizes the closest AWS edge location, ensuring efficient routing to our Tokyo infrastructure. This minimizes latency and delivers a smooth user experience regardless of your geographical location.

For a more in-depth explanation, check out the [AWS Global Accelerator docs](https://aws.amazon.com/global-accelerator/features/).