# Gotenberg

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/gotenberg` |
| **Kind** | **vendor** (`src/vendors/gotenberg`) |
| **Module id** | `gotenberg` |
| **Client** | `GotenbergClient` |

Self-hosted Gotenberg HTML/URL → PDF / screenshot. Writes result to nested S3 storage as `ArtifactRef`.

## Auth

```ts
{
  gotenberg_base_url: string
  gotenberg_api_username?: string
  gotenberg_api_password?: string
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

`gotenberg-render-pdf`, `gotenberg-render-screenshot`.

## Bind

```ts
import { GotenbergClient, gotenbergModule } from '@harryy/ai-tools/gotenberg'
import { withAuth } from '@harryy/ai-tools/core'

withAuth(gotenbergModule, {
  gotenberg_base_url: 'http://localhost:3000',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
  },
})
```

Seam: [document-render](../modules/document-render.md) with `provider: 'gotenberg'`.
