# Files

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/files` |
| **Kind** | **seam** (`src/modules/files`) |
| **Module id** | `files` |
| **Auth** | Host: `root_prefix` + nested `storage` (`s3` \| `r2` \| `supabase`) |

Path-rooted file manage over object storage. The model only sees paths **relative** to `root_prefix`. Host maps tenant → prefix + storage credentials.

## Bind

```ts
withAuth(filesModule, {
  root_prefix: 'orgs/acme/files/',
  storage: {
    provider: 's3',
    access_key_id: '…',
    secret_access_key: '…',
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
| `files-put` | write | Upload or replace body |
| `files-delete` | delete | Delete one file |
| `files-copy` | write | Copy within the same root |
| `files-move` | write | Move within the same root |
| `files-mkdir` | write | Create folder marker (`path/.keep`) |
| `files-multipart-start` | write | Start multipart (requires `storage.provider: 's3'`) |
| `files-multipart-upload-part` | write | Upload one part |
| `files-multipart-complete` | write | Assemble parts |
| `files-multipart-abort` | delete | Abort in-progress multipart |

Nested storage auth matches [storage](./storage.md).
