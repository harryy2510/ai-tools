# ofetch service clients

HTTP providers use a **two-layer** pattern:

1. **Shared transport** — `src/shared/ofetch-client.ts`
2. **Named service** — `createXService(auth, ctx)` with endpoint methods
3. **Ops** — map tool I/O only; no path strings or status handling

## Shared API

| Export | Role |
| --- | --- |
| `createServiceFetch` | Fixed-origin (or free-form) ofetch instance; host headers, `ctx.fetch` / `signal` |
| `serviceRequestJson` | JSON/text request; maps non-2xx → `ToolError` unless `allowStatuses` / `throwOnError: false` |
| `serviceRequestBytes` | Binary `arrayBuffer` request |
| `mapOfetchError` | Network / abort → `ToolError` |
| `encodeObjectKeyPath` | Object key path encoding (`/` preserved as separators) |
| `toArrayBuffer` | Copy `Uint8Array` for upload bodies |

## Provider coverage

| Provider | Client | Service pattern |
| --- | --- | --- |
| email / cloudflare | ofetch | `createCloudflareEmailService` |
| email / resend | ofetch | `createResendService` |
| storage / r2 | ofetch | `createR2RestService` |
| storage / supabase | ofetch | `createSupabaseStorageService` |
| file-convert / transmute | ofetch | `createTransmuteService` |
| web-fetch | ofetch | free-form absolute URLs via `createServiceFetch` + `throwOnError: false` |
| storage / s3 | **aws4fetch** | SigV4 (not ofetch) |
| document-extract / textract | **aws4fetch** | SigV4 (not ofetch) |

## Rules

- Recreate the service per execute (cheap); close over current `ctx` / auth.
- Never put credentials on tool inputs.
- Prefer native bulk APIs inside the service; batch tools stay in module ops.
