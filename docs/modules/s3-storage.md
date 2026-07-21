# S3 Storage

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/s3-storage` |
| **Module id** | `s3-storage` |
| **Runtime** | `both` |
| **Auth** | Custom — access keys + bucket (+ optional endpoint / session) |
| **Compatible** | AWS S3, Cloudflare R2, MinIO, other S3-compatible APIs |

Object storage tools signed with [aws4fetch](https://github.com/mhart/aws4fetch).

## Install / import

```ts
import {
  s3StorageModule,
  s3StorageAuthSchema,
  listObjectsTool,
  getObjectTool,
  putObjectTool,
  deleteObjectTool,
  headObjectTool,
  copyObjectTool,
  createSignedUrlTool,
} from '@harryy/ai-tools/s3-storage'
import type { S3StorageAuth } from '@harryy/ai-tools/s3-storage'
```

## Auth (host-facing)

```ts
type S3StorageAuth = {
  accessKeyId: string
  secretAccessKey: string
  region: string           // e.g. us-east-1 or R2 "auto"
  bucket: string           // default bucket
  endpoint?: string        // R2/MinIO custom endpoint URL
  sessionToken?: string    // temporary credentials
}
```

```ts
const bound = withAuth(s3StorageModule, {
  accessKeyId: '…',
  secretAccessKey: '…',
  region: 'auto',
  bucket: 'my-bucket',
  endpoint: 'https://<accountid>.r2.cloudflarestorage.com',
})
```

## Limits

- **Get / put body** max **5 MiB** per call (`too_large` if exceeded).
- Signed URL lifetime: **1 … 604800** seconds (default **3600**).

## Tools

### `s3-list-objects` (`listObjects`) — sideEffect `read`

| Input | Notes |
| --- | --- |
| `prefix?` | Key prefix |
| `delimiter?` | e.g. `/` for folder-style common prefixes |
| `continuation_token?` | Pagination |
| `max_keys?` | 1–1000 |

| Output | Notes |
| --- | --- |
| `keys` | Convenience string list |
| `objects` | `{ key, size?, last_modified?, etag? }[]` |
| `common_prefixes?` | When delimiter set |
| `is_truncated` | |
| `next_continuation_token?` | |

### `s3-get-object` (`getObject`) — `read`

| Input | Notes |
| --- | --- |
| `key` | Object key |
| `encoding?` | `base64` (default) or `utf8` |

Returns `body`, `encoding`, optional `content_type` / `content_length`.

### `s3-put-object` (`putObject`) — `write`

| Input | Notes |
| --- | --- |
| `key` | |
| `body` | String payload |
| `body_encoding?` | `utf8` (default) or `base64` |
| `content_type?` | Stored Content-Type |

Returns `key`, `content_length`, optional `etag`.

### `s3-delete-object` (`deleteObject`) — `delete`

Idempotent when the store returns success/404.

### `s3-head-object` (`headObject`) — `read`

Returns `exists` plus metadata when present (no body download).

### `s3-copy-object` (`copyObject`) — `write`

| Input | Notes |
| --- | --- |
| `source_key` | |
| `destination_key` | |
| `source_bucket?` | Defaults to configured bucket |

Server-side copy via `x-amz-copy-source`.

### `s3-create-signed-url` (`createSignedUrl`) — `none`

| Input | Notes |
| --- | --- |
| `key` | |
| `method?` | `GET` (default), `PUT`, `HEAD`, `DELETE` |
| `expires_in?` | Seconds |

Returns `{ url, method, expires_in }` with query-string SigV4 signature.

## Errors

| Code | When |
| --- | --- |
| `bad_auth` | Missing/invalid credentials |
| `bad_input` | Invalid base64 body, etc. |
| `not_found` | Missing object on get |
| `forbidden` | HTTP 403 |
| `rate_limited` | HTTP 429 |
| `too_large` | Over 5 MiB get/put |
| `upstream` | Other provider failures |
| `internal` | Signed URL construction failure |

## Testing

Tools use `aws4fetch` → global `fetch`. Tests should mock `globalThis.fetch` and accept a single `Request` argument (aws4fetch passes a signed `Request`).

## Related

- [Adapters](../guides/adapters.md)
- [MIME](./mime.md) for email payloads you might store
