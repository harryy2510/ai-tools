# Resend

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/resend` |
| **Kind** | **vendor** (`src/vendors/resend`) |
| **Module id** | `resend` |
| **Client** | `ResendClient` |
| **Tools** | `resend-send`, `resend-send-batch` |

Full **Resend vendor pack**. Not a multi-provider email seam. Start surface is send; grow more Resend APIs here over time.

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
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(resendModule, { api_key: '…' })
const tools = createMastraTools(bound)
```

Tools only call `ResendClient.fromContext(ctx)` — same implementation as the host client.

## Auth

`{ api_key: string }` — host-bound only (never tool input).

## Layout (gold vendor)

```text
contracts.ts · domain.ts · client.ts · module.ts · index.ts
```

Email vertical kit: `src/vendors/_email/`. Multi-provider seam: [email](../modules/email.md).
