# MIME

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/mime` |
| **Module id** | `mime` |
| **Runtime** | `both` |
| **Auth** | **none** |
| **Libraries** | `postal-mime` (parse), `mimetext` (build) |

Parse and build RFC 822 / MIME messages **without sending**. Pair with [cloudflare-email](./cloudflare-email.md) or SMTP in the host when you need delivery.

## Install / import

```ts
import {
  mimeModule,
  parseMimeTool,
  buildMimeTool,
} from '@harryy/ai-tools/mime'
```

No `withAuth` required:

```ts
import { createMcpTools } from '@harryy/ai-tools/mcp'
import { mimeModule } from '@harryy/ai-tools/mime'

const tools = createMcpTools(mimeModule)
```

## Tools

### `mime-parse` (`parseMime`) — sideEffect `read`

| Input | Notes |
| --- | --- |
| `raw` | Full message string |
| `encoding?` | `utf8` (default) or `base64` |

**Output (fields optional unless noted)**

| Field | Notes |
| --- | --- |
| `subject` | |
| `from` | `{ address, name? }` |
| `to` / `cc` / `bcc` / `reply_to` | Address arrays |
| `message_id` / `in_reply_to` / `references` / `date` | Header identifiers |
| `text` / `html` | Bodies |
| `headers` | `{ key, value }[]` (lowercase keys) |
| `attachments` | Always array; items may include `filename`, `mimeType`, `size`, `disposition`, `content_id`, `content_base64` |

### `mime-build` (`buildMime`) — sideEffect `none`

| Input | Notes |
| --- | --- |
| `from` | Email string or `{ address, name? }` |
| `to` | One or many |
| `subject` | Required |
| `text` / `html` | At least one required |
| `cc` / `bcc` / `reply_to` | Optional |
| `headers` | Optional string map of extra headers |
| `attachments[]` | Up to 32: `filename`, `content_base64`, optional `content_type`, `inline`, `content_id` |

**Output:** `{ raw }` serialized MIME message.

## Round-trip example

```ts
import { runTool } from '@harryy/ai-tools/core'
import { buildMimeTool, parseMimeTool } from '@harryy/ai-tools/mime'

const { raw } = await runTool(buildMimeTool, {
  from: { address: 'a@example.com', name: 'Ada' },
  to: 'b@example.com',
  subject: 'Hello',
  text: 'Plain body',
  html: '<p>Plain body</p>',
  headers: { 'X-Trace': 'trace-1' },
  attachments: [
    {
      filename: 'note.txt',
      content_type: 'text/plain',
      content_base64: btoa('note body'),
    },
  ],
})

const parsed = await runTool(parseMimeTool, { raw })
// parsed.subject === 'Hello'; attachments include note.txt
```

## Errors

| Code | When |
| --- | --- |
| `bad_input` | Invalid addresses, invalid base64 attachment, parse/build failure |

## Related

- [cloudflare-email](./cloudflare-email.md) for send
- [core](../packages/core.md) `runTool`
