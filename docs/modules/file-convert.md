# File Convert

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/file-convert` |
| **Module id** | `file-convert` |
| **Auth** | Host union: `provider: 'transmute'` + nested `storage` auth |
| **Tools** | `file-convert`, `file-convert-batch` |

## Bind (Transmute)

```ts
withAuth(fileConvertModule, {
  provider: 'transmute',
  transmute_base_url: 'https://transmute.example',
  transmute_token: '…',
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

Tools only take `ArtifactRef` + format — no credentials on model inputs. Nested `storage` is host-only.
