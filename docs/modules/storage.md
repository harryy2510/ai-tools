# Storage

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/storage` |
| **Module id** | `storage` |
| **Runtime** | `both` (native `r2` is Workers-oriented) |
| **Auth** | Host union: `provider: 's3' \| 'r2' \| 'supabase'` |

Object storage capability: list (cursor pagination), get/put/delete/head/copy, signed URL when supported, and batch get/put/delete (max 25).

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { storageModule } from '@harryy/ai-tools/storage'

const bound = withAuth(storageModule, {
  provider: 's3',
  accessKeyId: '…',
  secretAccessKey: '…',
  region: 'auto',
  bucket: 'my-bucket',
  endpoint: 'https://….r2.cloudflarestorage.com', // optional S3-compatible
})
```

### Native R2

```ts
withAuth(storageModule, { provider: 'r2', bucket: 'assets' })
// Host injects bindings:
// ctx.extras.r2Buckets = { assets: env.MY_BUCKET }
```

### Supabase

```ts
withAuth(storageModule, {
  provider: 'supabase',
  url: 'https://….supabase.co',
  serviceRoleKey: '…',
  bucket: 'media',
})
```

## Tool ids

`storage-list-objects`, `storage-get-object`, `storage-put-object`, `storage-delete-object`, `storage-head-object`, `storage-copy-object`, `storage-create-signed-url`, `storage-get-objects`, `storage-put-objects`, `storage-delete-objects`.

List uses `cursor` / `next_cursor` / `truncated` (not vendor token names on the model surface).
