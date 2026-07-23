# File Convert

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/file-convert` |
| **Kind** | multi-provider **seam** (`src/modules/file-convert`) |
| **Module id** | `file-convert` |
| **Auth** | Host union: `provider: 'transmute'` + nested `storage` |
| **Tools** | `file-convert`, `file-convert-batch` |

## Bind (Transmute)

```ts
withAuth(fileConvertModule, {
  provider: 'transmute',
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

Nested `storage` is S3 auth fields only (no nested `provider`).

Tools only take `ArtifactRef` + format — no credentials on model inputs. Nested `storage` is host-only.

Vendor pack: [transmute](../vendors/transmute.md). Spec: [artifacts-extract-convert](../specs/artifacts-extract-convert.md).
