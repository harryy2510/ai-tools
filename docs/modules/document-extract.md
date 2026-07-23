# Document Extract

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/document-extract` |
| **Kind** | multi-provider **seam** (`src/modules/document-extract`) |
| **Module id** | `document-extract` |
| **Auth** | Host union: `provider: 'textract'` (+ more later) |
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
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  bucket: 'docs', // AWS S3 bucket Textract can read
})
```

Textract requires a real AWS S3 object location. Vendor pack: [textract](../vendors/textract.md). Spec: [artifacts-extract-convert](../specs/artifacts-extract-convert.md).
