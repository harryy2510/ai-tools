# Katana

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/katana` |
| **Kind** | **vendor** (`src/vendors/katana`) |
| **Module id** | `katana` |
| **Client** | `KatanaClient` |
| **API** | `https://api.katanamrp.com/v1` |

First action group: **sales orders** (list/get). Expand with manufacturing reads as needed.

## Auth

```ts
{ api_key: string }  // Bearer token
```

## Tools

| id | Client method |
| --- | --- |
| `katana-list-sales-orders` | `listSalesOrders` |
| `katana-get-sales-order` | `getSalesOrder` |

## Bind

```ts
import { KatanaClient, katanaModule } from '@harryy/ai-tools/katana'
import { withAuth } from '@harryy/ai-tools/core'

new KatanaClient({ api_key: '…' })
withAuth(katanaModule, { api_key: '…' })
```
