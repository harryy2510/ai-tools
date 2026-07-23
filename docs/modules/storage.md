# Storage

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/storage` |
| **Kind** | multi-provider **seam** (`src/modules/storage`) |
| **Module id** | `storage` |
| **Runtime** | `both` |
| **Auth** | Host union: `provider: 's3' \| 'r2' \| 'supabase'` |

Object storage capability: list (cursor pagination), get/put/delete/head/copy, signed URL and multipart when supported, and batch get/put/delete (max 25).

## Providers

| provider | Transport | Auth | When |
| --- | --- | --- | --- |
| `s3` | SigV4 (S3 API) | `access_key_id`, `secret_access_key`, `region`, `bucket`, optional `endpoint` / `session_token` | AWS S3, **R2 S3 endpoint**, MinIO |
| `r2` | Cloudflare REST | `account_id`, `api_token`, `bucket`, optional `jurisdiction` | R2 via `api.cloudflare.com` |
| `supabase` | Supabase Storage REST | `url`, `service_role_key`, `bucket` | Native Supabase Storage |

Not supported: Workers `env.R2` bindings. Use `s3` + R2 endpoint or `r2` REST.

### `s3` (includes R2 S3-compatible)

```ts
withAuth(storageModule, {
  provider: 's3',
  access_key_id: '…',
  secret_access_key: '…',
  region: 'auto',
  bucket: 'my-bucket',
  endpoint: 'https://<account_id>.r2.cloudflarestorage.com',
})
```

### `r2` (Cloudflare REST)

```ts
withAuth(storageModule, {
  provider: 'r2',
  account_id: '…',
  api_token: '…',
  bucket: 'my-bucket',
  // jurisdiction: 'eu',
})
```

Signed URLs and multipart are **unsupported** on this path (use `s3` for presign and multipart).

### `supabase`

```ts
withAuth(storageModule, {
  provider: 'supabase',
  url: 'https://….supabase.co',
  service_role_key: '…',
  bucket: 'media',
})
```

## Tool ids

`storage-list-objects`, `storage-get-object`, `storage-put-object`, `storage-delete-object`, `storage-head-object`, `storage-copy-object`, `storage-create-signed-url`, `storage-create-multipart-upload`, `storage-upload-part`, `storage-complete-multipart-upload`, `storage-abort-multipart-upload`, `storage-get-objects`, `storage-put-objects`, `storage-delete-objects`.

### Multipart (S3-compatible only)

| id | Notes |
| --- | --- |
| `storage-create-multipart-upload` | Returns `upload_id` |
| `storage-upload-part` | Part body ≤ 25 MiB; S3 min 5 MiB except last part |
| `storage-complete-multipart-upload` | `{ part_number, etag }[]` |
| `storage-abort-multipart-upload` | Discard in-progress upload |

Providers `r2` (REST) and `supabase` throw `unsupported` for multipart tools.

Vendor packs: [s3](../vendors/s3.md), [r2](../vendors/r2.md), [supabase-storage](../vendors/supabase-storage.md).
