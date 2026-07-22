# Resend

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/resend` |
| **Kind** | **vendor** (3rd party; under `src/vendors/resend`) |
| **Module id** | `resend` |
| **Client** | `ResendClient` (class) |
| **Tools** | `resend-send`, `resend-send-batch` |

Full **Resend vendor pack**. Not a multi-provider email seam. Start surface is send; grow the rest of the Resend API here over time.

## Host (client)

```ts
import { ResendClient } from '@harryy/ai-tools/resend'

const resend = new ResendClient({ api_key: '…' })
await resend.send({ to, from, subject, text })
await resend.sendBatch({ messages: […] })
```

## Agent (tools)

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { resendModule } from '@harryy/ai-tools/resend'
import { createMastraTools } from '@harryy/ai-tools/mastra' // or ai-sdk / mcp / …

const bound = withAuth(resendModule, { api_key: '…' })
const tools = createMastraTools(bound)
```

Tools only call `ResendClient.fromContext(ctx)` — same implementation as the host client.

## Auth

`{ api_key: string }` — host-bound only (never tool input).

## Layout (gold vendor)

`contracts` · `domain` · `client` (class + private ofetch `sendEmail`) · `module` (tools → client) · `index`
