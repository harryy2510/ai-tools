# iMessage (photon-rest-proxy)

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/imessage` |
| **Kind** | **vendor** (`src/vendors/imessage`) |
| **Module id** | `imessage` |
| **Client** | `ImessageClient` |
| **Runtime** | `both` (HTTP only — gRPC stays in the proxy container) |

Outbound iMessage via a hosted **[photon-rest-proxy](https://github.com/harryy2510)** (or your deploy of `~/Desktop/hariom/photon-rest-proxy`). The pack never talks to Photon gRPC directly.

**Inbound:** Photon native webhooks → your host (not this pack’s HTTP client).

## Auth

```ts
{
  base_url: string          // proxy origin, e.g. https://photon-proxy.example.com
  project_id: string        // → x-spectrum-project-id
  project_secret: string    // → x-spectrum-project-secret
  phone?: string            // optional default multi-line phone
}
```

## Tools

| id | Proxy |
| --- | --- |
| `imessage-send-text` | `POST /v1/send` |
| `imessage-edit-text` | `POST /v1/edit` |
| `imessage-send-chat-action` | `POST /v1/typing` (start) |
| `imessage-set-reaction` | `POST /v1/react` |
| `imessage-unsend` | `POST /v1/unsend` |
| `imessage-read` | `POST /v1/read` |

`chat_id` is the Spectrum **space id** (e.g. `any;-;+15551111111`).

Not on proxy v1 (throw `unsupported`): `clearReaction`, `sendMedia`, `downloadFile`.

## Bind

```ts
import { ImessageClient, imessageModule } from '@harryy/ai-tools/imessage'
import { withAuth } from '@harryy/ai-tools/core'

const client = new ImessageClient({
  base_url: 'https://photon-proxy.example.com',
  project_id: process.env.SPECTRUM_PROJECT_ID!,
  project_secret: process.env.SPECTRUM_PROJECT_SECRET!,
})

await client.sendText({
  chat_id: 'any;-;+15551111111',
  text: 'hello',
})

withAuth(imessageModule, { /* same auth */ })
```

## Messaging seam

```ts
withAuth(messagingModule, {
  provider: 'imessage',
  base_url: 'https://photon-proxy.example.com',
  project_id: '…',
  project_secret: '…',
})
```

## Live progressive text

Use `createLiveMessage` with `isImessageDefiniteRejection` / `isImessageOutcomeUnknown`.
