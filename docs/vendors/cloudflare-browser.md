# Cloudflare Browser Rendering

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-browser` |
| **Kind** | **vendor** (`src/vendors/cloudflare-browser`) |
| **Module id** | `cloudflare-browser` |
| **Client** | `CloudflareBrowserClient` |

Cloudflare Browser Rendering → PDF / screenshot. Writes result to nested S3 storage as `ArtifactRef`.

## Auth

```ts
{
  account_id: string
  api_token: string
  storage: {
    access_key_id: string
    secret_access_key: string
    region: string
    bucket: string
    endpoint?: string
    session_token?: string
  }
}
```

## Tools

`cloudflare-browser-render-pdf`, `cloudflare-browser-render-screenshot`.

## Bind

```ts
import { CloudflareBrowserClient, cloudflareBrowserModule } from '@harryy/ai-tools/cloudflare-browser'
import { withAuth } from '@harryy/ai-tools/core'

withAuth(cloudflareBrowserModule, {
  account_id: '…',
  api_token: '…',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
  },
})
```

Seam: [document-render](../modules/document-render.md) with `provider: 'cloudflare-browser'`.
