# Cloudflare Email

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-email` |
| **Module id** | `cloudflare-email` |
| **Runtime** | `both` |
| **Auth** | Custom — Cloudflare account + API token |
| **Side effects** | `send` |

Send transactional email through the [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) REST API.

## Install / import

```ts
import {
  cloudflareEmailModule,
  cloudflareEmailAuthSchema,
  sendEmailTool,
} from '@harryy/ai-tools/cloudflare-email'
import type { CloudflareEmailAuth } from '@harryy/ai-tools/cloudflare-email'
```

## Auth (host-facing)

```ts
type CloudflareEmailAuth = {
  accountId: string  // Cloudflare account id
  apiToken: string   // token with Email Sending permission
}
```

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(cloudflareEmailModule, {
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
})

const tools = createMastraTools(bound)
```

Model-facing tool inputs **do not** include account id or token.

## Tools

### `cloudflare-email-send` (`sendEmail`)

Send one message.

**Limits**

- Combined `to` + `cc` + `bcc` ≤ **50** recipients
- Attachments ≤ **32**
- Total JSON payload ≤ **5 MiB** (preflight; fails with `too_large` before network)

**Input (summary)**

| Field | Required | Notes |
| --- | --- | --- |
| `to` | yes | Address string, `{ email, name? }`, or array |
| `from` | yes | Verified sender on your sending domain |
| `subject` | yes | 1–998 chars |
| `html` / `text` | one required | At least one non-empty body |
| `cc` / `bcc` | no | Same address shapes |
| `reply_to` | no | |
| `headers` | no | String map (allowlisted / `X-` custom per CF) |
| `attachments[]` | no | `content` base64, `filename`, `type`, optional `disposition` |

**Output**

| Field | Notes |
| --- | --- |
| `success` | API accepted |
| `delivered` | Addresses delivered immediately |
| `queued` | Queued for later |
| `permanent_bounces` | Permanent bounces |

**Errors**

| Code | When |
| --- | --- |
| `bad_input` | Too many recipients, missing body (schema) |
| `bad_auth` | Invalid/missing credentials or CF auth error |
| `too_large` | Payload over 5 MiB |
| `forbidden` / `rate_limited` / `upstream` | From HTTP or CF `success: false` body |

## Example execute

```ts
import { runTool, withAuth } from '@harryy/ai-tools/core'
import { cloudflareEmailModule, sendEmailTool } from '@harryy/ai-tools/cloudflare-email'

const bound = withAuth(cloudflareEmailModule, { accountId: '…', apiToken: '…' })
const tool = bound.tools.find((t) => t.id === sendEmailTool.id)!

await runTool(tool, {
  to: { email: 'user@example.com', name: 'User' },
  from: 'noreply@your-domain.example',
  subject: 'Welcome',
  text: 'Thanks for signing up.',
  html: '<p>Thanks for signing up.</p>',
})
```

## Related

- [MIME](./mime.md) for build/parse without sending
- [HTTP package](../packages/http.md)
