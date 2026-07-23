# Transmute

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/transmute` |
| **Kind** | **vendor** (`src/vendors/transmute`) |
| **Module id** | `transmute` |
| **Client** | `TransmuteClient` |

Self-hosted [Transmute](https://github.com/transmute-app/transmute) file conversion. Reads/writes **artifacts** via nested S3 auth.

## Auth

```ts
{
  transmute_base_url: string
  transmute_token: string
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

`transmute-convert`, `transmute-convert-batch`.

Input: `ArtifactRef` + `output_format` (+ optional `output_key`). No credentials on tool inputs.

## Bind

```ts
import { TransmuteClient, transmuteModule } from '@harryy/ai-tools/transmute'
import { withAuth } from '@harryy/ai-tools/core'

withAuth(transmuteModule, {
  transmute_base_url: 'https://transmute.example',
  transmute_token: '…',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
    endpoint: 'https://….r2.cloudflarestorage.com',
  },
})
```

Seam: [file-convert](../modules/file-convert.md) with `provider: 'transmute'`.
