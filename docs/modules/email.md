# Email

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/email` |
| **Module id** | `email` |
| **Runtime** | `both` |
| **Auth** | Host union: `provider: 'cloudflare' \| 'resend'` |
| **Tools** | `email-send`, `email-send-batch` |

Capability module for transactional email. Provider is selected by host auth, not tool args.

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'

const bound = withAuth(emailModule, {
  provider: 'resend',
  apiKey: '…',
})
// or provider: 'cloudflare', accountId, apiToken
```

## Tools

### `email-send` — sideEffect `send`

Generic input: to, from, subject, html/text, optional cc/bcc/reply_to/headers/attachments.

Generic output: `success`, optional `id`, `accepted[]`, `rejected[]`.

### `email-send-batch` — sideEffect `send`

Up to 20 messages. Per-item ok/error; partial failure allowed.

## Providers

| provider | Host auth fields |
| --- | --- |
| `cloudflare` | `accountId`, `apiToken` |
| `resend` | `apiKey` |
