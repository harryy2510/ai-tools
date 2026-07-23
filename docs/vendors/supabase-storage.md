# Supabase Storage

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/supabase-storage` |
| **Kind** | **vendor** (`src/vendors/supabase-storage`) |
| **Module id** | `supabase-storage` |
| **Client** | `SupabaseStorageClient` |

Native Supabase Storage REST API.

## Auth

```ts
{
  url: string              // https://….supabase.co
  service_role_key: string
  bucket: string
}
```

## Tools

`supabase-storage-list-objects`, `supabase-storage-get-object`, `supabase-storage-put-object`, `supabase-storage-delete-object`, `supabase-storage-head-object`, `supabase-storage-copy-object`.

## Bind

```ts
import { SupabaseStorageClient, supabaseStorageModule } from '@harryy/ai-tools/supabase-storage'
import { withAuth } from '@harryy/ai-tools/core'

new SupabaseStorageClient({
  url: 'https://….supabase.co',
  service_role_key: '…',
  bucket: 'media',
})

withAuth(supabaseStorageModule, {
  url: 'https://….supabase.co',
  service_role_key: '…',
  bucket: 'media',
})
```

Seam: [storage](../modules/storage.md) with `provider: 'supabase'`.
