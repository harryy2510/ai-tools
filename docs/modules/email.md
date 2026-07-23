# Email

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/email` |
| **Kind** | multi-provider **seam** (`src/modules/email`) |
| **Module id** | `email` |
| **Providers** | `resend`, `cloudflare` |
| **Tools** | `email-send`, `email-send-batch` |

Shared send contract over [Resend](../vendors/resend.md) and [Cloudflare Email](../vendors/cloudflare-email.md). For full vendor APIs beyond send, use the vendor pack directly.

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(emailModule, { provider: 'resend', api_key: '…' })
// or
withAuth(emailModule, {
  provider: 'cloudflare',
  account_id: '…',
  api_token: '…',
})

const tools = createMastraTools(bound)
```

For host DX without the seam, use the vendor clients directly: [ResendClient](../vendors/resend.md), [CloudflareEmailClient](../vendors/cloudflare-email.md).

## Tools

| id | sideEffect |
| --- | --- |
| `email-send` | `send` |
| `email-send-batch` | `send` |

Same body shape as Resend send (named addresses, html/text, optional attachments). Max 5 MiB; batch max 20.
