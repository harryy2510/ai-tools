# Email

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/email` |
| **Module id** | `email` |
| **Runtime** | `both` |
| **Auth** | Host union: `provider: 'cloudflare' \| 'resend'` |
| **Public client** | `EmailClient` |
| **Tools** | `email-send`, `email-send-batch` |

Transactional email capability. **Host DX is the client.** Tools are the agent projection of the same methods.

## Client (preferred)

```ts
import { EmailClient } from '@harryy/ai-tools/email'

const email = new EmailClient({ provider: 'resend', apiKey: '…' })
// or { provider: 'cloudflare', accountId: '…', apiToken: '…' }

await email.send({
  to: 'hello@example.com',
  from: 'from@example.com',
  subject: 'Hi',
  text: 'Body',
})

await email.sendBatch({ messages: [/* … */] })
```

Optional constructor options: `fetch`, `signal` (tests / cancellation).

## Tools (agents)

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'

const bound = withAuth(emailModule, {
  provider: 'resend',
  apiKey: '…',
})
```

Tools call `EmailClient.fromContext(ctx)` only (no direct ofetch).

| Tool | Client method |
| --- | --- |
| `email-send` | `send` |
| `email-send-batch` | `sendBatch` |

## Layout

```text
contracts.ts   # Zod I/O + EmailOps
domain.ts      # shared preflight (no HTTP)
client.ts      # EmailClient class
providers/*    # createXService + ops
module.ts      # defineTool adapters
```

## Providers

| provider | Host auth fields | Service endpoints |
| --- | --- | --- |
| `resend` | `apiKey` | `sendEmail` → `POST /emails` |
| `cloudflare` | `accountId`, `apiToken` | `sendEmail` → account email sending path |

Both use ofetch (`createServiceFetch` + `serviceRequestJson`). Shared recipient/size checks live in `domain.ts`.
