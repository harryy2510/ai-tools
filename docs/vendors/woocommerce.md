# WooCommerce

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/woocommerce` |
| **Kind** | **vendor** (`src/vendors/woocommerce`) |
| **Module id** | `woocommerce` |
| **Client** | `WoocommerceClient` |
| **API** | REST `wc/v3` |

First action group: **orders + products** (list/get). Expand with customers, coupons, etc. over time.

## Auth

```ts
{
  store_url: string         // https://shop.example.com
  consumer_key: string
  consumer_secret: string
}
```

HTTPS Basic Auth (consumer key as username, secret as password).

## Tools

| id | Client method |
| --- | --- |
| `woocommerce-list-orders` | `listOrders` |
| `woocommerce-get-order` | `getOrder` |
| `woocommerce-list-products` | `listProducts` |
| `woocommerce-get-product` | `getProduct` |

## Bind

```ts
import { WoocommerceClient, woocommerceModule } from '@harryy/ai-tools/woocommerce'
import { withAuth } from '@harryy/ai-tools/core'

new WoocommerceClient({
  store_url: 'https://shop.example.com',
  consumer_key: 'ck_…',
  consumer_secret: 'cs_…',
})

withAuth(woocommerceModule, { /* same */ })
```
