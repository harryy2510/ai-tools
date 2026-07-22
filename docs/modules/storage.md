# Storage

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/storage` |
| **Module id** | `storage` |
| **Runtime** | `both` |
| **Auth** | Host union: `provider: 's3' \| 'r2' \| 'supabase'` |

Object storage capability: list (cursor pagination), get/put/delete/head/copy, signed URL and multipart when supported, and batch get/put/delete (max 25).

## Three ways in (host chooses)

| provider | Transport | Auth | When |
| --- | --- | --- | --- |
| `s3` | **aws4fetch** (S3 API / SigV4) | access key + secret + region + bucket (+ optional endpoint) | AWS S3, **R2 S3 endpoint**, MinIO, other S3-compatible |
| `r2` | **ofetch** → Cloudflare REST API | account id + API token + bucket | R2 via `api.cloudflare.com` object routes ([docs](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/)) |
| `supabase` | **ofetch** → Supabase Storage REST | project URL + service role key + bucket | Native Supabase Storage API |

Not supported: Workers `env.R2` bindings. Use `s3` + R2 endpoint or `r2` REST.

### `s3` (includes R2 S3-compatible)

```ts
withAuth(storageModule, {
  provider: 's3',
  accessKeyId: '…',
  secretAccessKey: '…',
  region: 'auto',
  bucket: 'my-bucket',
  endpoint: 'https://<account_id>.r2.cloudflarestorage.com', // R2 S3 API
})
```

### `r2` (Cloudflare REST, not binding)

```ts
withAuth(storageModule, {
  provider: 'r2',
  accountId: '…',
  apiToken: '…', // R2 object permissions
  bucket: 'my-bucket',
  // jurisdiction: 'eu', // optional cf-r2-jurisdiction
})
```

Object routes:

- `GET /accounts/{account_id}/r2/buckets/{bucket}/objects`
- `GET|PUT|DELETE …/objects/{key}`

Signed URLs and multipart are **unsupported** on this path (use `s3` for presign and multipart). Copy is get+put (same bucket only).

### `supabase`

```ts
withAuth(storageModule, {
  provider: 'supabase',
  url: 'https://….supabase.co',
  serviceRoleKey: '…',
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
| `storage-complete-multipart-upload` | `{ part_number, etag }[]` (any order) |
| `storage-abort-multipart-upload` | Discard in-progress upload |

Providers `r2` (REST) and `supabase` throw `unsupported` for multipart tools.
