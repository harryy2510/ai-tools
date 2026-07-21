# Document Extract

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/document-extract` |
| **Module id** | `document-extract` |
| **Auth** | Host union: `provider: 'textract'` (more providers later) |
| **Source** | `ArtifactRef` with `store: 'object'` |

## Tools

| id | sideEffect |
| --- | --- |
| `document-extract-text` | `read` |
| `document-extract-status` | `read` |
| `document-extract-text-batch` | `read` |

## Bind (Textract)

```ts
withAuth(documentExtractModule, {
  provider: 'textract',
  accessKeyId: '…',
  secretAccessKey: '…',
  region: 'us-east-1',
  bucket: 'docs', // AWS S3 bucket Textract can read
})
```

Textract requires a real AWS S3 object location. See [provider-seam](../specs/provider-seam.md).
