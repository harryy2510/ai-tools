# Amazon SP-API

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/amazon-sp-api` |
| **Kind** | **vendor** (`src/vendors/amazon-sp-api`) |
| **Module id** | `amazon-sp-api` |
| **Client** | `AmazonSpApiClient` |

First action group: **orders** (list/get) + **FBA inventory summaries**. Reports and more APIs come later — do not block on full SP-API coverage.

## Auth

```ts
{
  client_id: string
  client_secret: string
  refresh_token: string
  access_key_id: string
  secret_access_key: string
  region: string              // SigV4 region (e.g. us-east-1)
  endpoint: 'https://sellingpartnerapi-na.amazon.com'
    | 'https://sellingpartnerapi-eu.amazon.com'
    | 'https://sellingpartnerapi-fe.amazon.com'
  session_token?: string
  marketplace_ids?: string[]  // default marketplaces for tools
}
```

Flow: LWA refresh → `access_token`, then SP-API calls with **AwsService** (`execute-api` SigV4) + `x-amz-access-token`.

## Tools

| id | Client method |
| --- | --- |
| `amazon-sp-api-list-orders` | `listOrders` |
| `amazon-sp-api-get-order` | `getOrder` |
| `amazon-sp-api-list-inventory-summaries` | `listInventorySummaries` |

## Bind

```ts
import { AmazonSpApiClient, amazonSpApiModule } from '@harryy/ai-tools/amazon-sp-api'
import { withAuth } from '@harryy/ai-tools/core'

new AmazonSpApiClient({
  client_id: '…',
  client_secret: '…',
  refresh_token: '…',
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  endpoint: 'https://sellingpartnerapi-na.amazon.com',
  marketplace_ids: ['ATVPDKIKX0DER'],
})

withAuth(amazonSpApiModule, { /* same */ })
```
