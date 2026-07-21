# Document Render

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/document-render` |
| **Module id** | `document-render` |
| **Auth** | Host union: `provider: 'gotenberg' \| 'cloudflare-browser'` + nested `storage` |
| **Tools** | `document-render-pdf`, `document-render-screenshot`, batches |

HTML or URL → PDF / PNG via a browser/print engine. **Not** format conversion (`file-convert` / Transmute).

## Providers

| provider | Transport | Notes |
| --- | --- | --- |
| `gotenberg` | ofetch → self-hosted Gotenberg | Preferred self-host |
| `cloudflare-browser` | ofetch → CF Browser Rendering | Managed; matches FSS custom path |

Both write results to nested **S3-compatible** storage and return `ArtifactRef`.

## Bind

```ts
withAuth(documentRenderModule, {
  provider: 'gotenberg',
  gotenberg_base_url: 'http://localhost:3000',
  storage: {
    provider: 's3',
    accessKeyId: '…',
    secretAccessKey: '…',
    region: 'auto',
    bucket: 'artifacts',
    endpoint: 'https://….r2.cloudflarestorage.com',
  },
})
```

```ts
withAuth(documentRenderModule, {
  provider: 'cloudflare-browser',
  accountId: '…',
  apiToken: '…',
  storage: { provider: 's3', /* … */ },
})
```

## Input

- `source.html` **or** `source.url`
- optional `output_key`, `filename`, screenshot `viewport`
