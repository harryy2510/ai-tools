# Cloudflare Email

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-email` |
| **Kind** | **vendor** (3rd party; under `src/vendors/cloudflare-email`) |
| **Module id** | `cloudflare-email` |
| **Client** | `CloudflareEmailClient` (class) |
| **Tools** | `cloudflare-email-send`, `cloudflare-email-send-batch` |

Full **Cloudflare Email Sending vendor pack**. Not a multi-provider email seam. Start surface is send; expand to the full CF email API as product needs.

## Host (client)

```ts
import { CloudflareEmailClient } from '@harryy/ai-tools/cloudflare-email'

const email = new CloudflareEmailClient({
  account_id: '…',
  api_token: '…',
})
await email.send({ to, from, subject, text })
await email.sendBatch({ messages: […] })
```

## Agent (tools)

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { cloudflareEmailModule } from '@harryy/ai-tools/cloudflare-email'

const bound = withAuth(cloudflareEmailModule, {
  account_id: '…',
  api_token: '…',
})
```

Tools call `CloudflareEmailClient.fromContext(ctx)` only.

## Auth

`{ account_id, api_token }` — host-bound only.

## Layout (vendor gold twin of resend)

`contracts` · `domain` · `client` (class + private ofetch `sendEmail`) · `module` (tools → client) · `index`
