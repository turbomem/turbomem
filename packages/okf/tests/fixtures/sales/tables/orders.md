---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, revenue]
timestamp: 2026-05-28T14:30:00Z
---

# Schema

| Column | Type | Description |
|---|---|---|
| order_id | STRING | Unique order ID |
| customer_id | STRING | FK to [customers](/tables/customers.md) |
