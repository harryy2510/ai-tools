# Spec: Provider seam for capability modules

Status: **locked**  
Package: `@harryy/ai-tools`  
Scope: **modules only** (`src/modules/*`). Vendors: [package-surface-architecture.md](./package-surface-architecture.md).

## Goals

- Tools are **capability-generic** (email, storage, extract, convert).
- Hosts pick a **provider** at bind time via auth `{ provider, … }`.
- Provider implementations are isolated behind a **type class** (`*Ops`) per module.
- Auth never appears on model-facing tool schemas.
- Batch tools, list pagination, and rate-limit errors are first-class.

## Kernel

| API | Role |
| --- | --- |
| `defineProvider` | `{ id, title, authSchema, ops }` |
| `resolveProvider` | Pick ops by `auth.provider` |
| `requireAuth` | Parse `ctx.auth` with module union schema |
| `withAuth` | Host bind (unchanged entry point) |

## Module layout

```text
src/modules/<capability>/
  contracts.ts      # Zod I/O + Ops type class
  module.ts         # generic tools + auth union
  providers/*.ts    # vendor implementations
  index.ts
```

## Auth

- Discriminated union on `provider`.
- Host-only: `withAuth(module, { provider: 'resend', api_key: '…' })` (snake_case auth fields).
- Nested host credentials allowed (e.g. file-convert `storage: { access_key_id, secret_access_key, region, bucket, … }` — nested storage is S3 auth, not a second provider union).
- Pure modules (`email-message`, `content-type`) use `auth: { type: 'none' }`.

## ArtifactRef

```ts
{ store: 'object' | 'host', key: string, media_type?, filename?, byte_length? }
```

`object` means the bound object store described by host auth.

## Current providers

| Module | Providers |
| --- | --- |
| `email` | `cloudflare`, `resend` |
| `storage` | `s3` (SigV4), `r2` (Cloudflare REST), `supabase` (Storage REST) |
| `document-extract` | `textract` |
| `document-render` | `gotenberg`, `cloudflare-browser` |
| `file-convert` | `transmute` (+ nested S3 `storage`) |
| `files` | nested `storage` union (`s3` \| `r2` \| `supabase`) + `root_prefix` |

Adding a provider: new file under `providers/`, register in module array, extend auth union, docs row. Model tool catalog stays stable.
