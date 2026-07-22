# Files

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/files` |
| **Module id** | `files` |
| **Auth** | Host: `root_prefix` + nested `storage` (`s3` \| `r2` \| `supabase`) |
| **Tools** | list, search, stat, get, put, delete, copy, move, mkdir, multipart start/part/complete/abort |

Path-rooted file manage over object storage. The model only sees paths **relative** to `root_prefix`. Host maps tenant → prefix + storage credentials (and keeps RLS).

## Bind

```ts
withAuth(filesModule, {
  root_prefix: 'orgs/acme/files/',
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

## Tools

| id | sideEffect | Behavior |
| --- | --- | --- |
| `files-list` | read | List files/folders under a relative path |
| `files-search` | read | Name-fragment match on last path segment |
| `files-stat` | read | Head metadata for one relative path |
| `files-get` | read | Download body (base64 default / utf8) |
| `files-put` | write | Upload or replace body (single-shot size limit from storage) |
| `files-delete` | delete | Delete one file |
| `files-copy` | write | Copy within the same root |
| `files-move` | write | Move within the same root (copy then delete source) |
| `files-mkdir` | write | Create folder marker (`path/.keep`) |
| `files-multipart-start` | write | Start multipart upload (requires `storage.provider: 's3'`) |
| `files-multipart-upload-part` | write | Upload one part (≤ 25 MiB; S3 min 5 MiB except last) |
| `files-multipart-complete` | write | Assemble parts into the final object |
| `files-multipart-abort` | delete | Abort in-progress multipart and discard parts |

## Multipart

Use when the object is larger than the single `files-put` limit. Lifecycle:

1. `files-multipart-start` → `upload_id`
2. `files-multipart-upload-part` (repeat; keep each part’s `etag`)
3. `files-multipart-complete` with `{ part_number, etag }[]`

Or `files-multipart-abort` to cancel.

Multipart is **S3-compatible only** (`storage.provider: 's3'`, including R2 S3 endpoint / MinIO). Bound `r2` REST or `supabase` returns `unsupported`.

## Isolation

- Rejects `..` and absolute paths in `root_prefix` and relative keys  
- All absolute object keys are `root_prefix + relative`  
- Results outside the root are dropped  
- Move/copy source and destination both resolve under the same root  
