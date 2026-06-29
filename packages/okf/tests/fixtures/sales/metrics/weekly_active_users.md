---
type: Metric
title: Weekly Active Users
description: Count of distinct users with at least one session in the past 7 days.
tags: [sales, engagement]
---

# Definition

Weekly active users (WAU) is computed as the count of distinct `customer_id` values
in the [orders](/tables/orders.md) table with an order in the last 7 days.
