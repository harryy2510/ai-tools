# ofetch service clients

**Status: hard rule.** Agents must not invent a second HTTP style.  
**Gold clones:**  
- Client DX: `src/modules/email/client.ts`  
- Provider ofetch: `src/modules/email/providers/resend.ts`, `src/modules/storage/providers/supabase.ts`  

**Package lock:** `AGENTS.md` → HARD RULES (R0–R7).

## Mandatory pattern (modules · vendors · channels)

```ts
function createXService(auth: XAuth, ctx: ToolContext) {
	const http = createServiceFetch(
		{
			baseURL: 'https://api.example.com',
			headers: {
				Authorization: `Bearer ${auth.token}`,
				'Content-Type': 'application/json' // only if all calls are JSON; omit if mixing FormData
			}
		},
		ctx
	)

	return {
		// One named method per API path. Body is Record or FormData — ofetch handles it.
		sendEmail: (body: Record<string, unknown>) =>
			serviceRequestJson(http, 'Resend send', '/emails', { method: 'POST', body }),

		getObject: (path: string) => serviceRequestBytes(http, 'Storage get', path)
	}
}

// Domain / ops: map tool input → svc.sendEmail(...) only. No paths. No fetch.
```

1. **`createServiceFetch`** — baseURL + host headers + `ctx`  
2. **`createXService(auth, ctx)`** — **endpoint methods only**  
3. **Ops / domain** — tool I/O map only  

## Shared API

| Export | Role |
| --- | --- |
| `createServiceFetch` | Fixed-origin (or free-form) ofetch; host headers, `ctx.fetch` / `signal` |
| `serviceRequestJson` | JSON/text; non-2xx → `ToolError` unless `allowStatuses` / `throwOnError: false` |
| `serviceRequestBytes` | Binary `arrayBuffer` |
| `mapOfetchError` | Network / abort → `ToolError` |
| `encodeObjectKeyPath` | Object key path encoding |
| `toArrayBuffer` | `Uint8Array` → `ArrayBuffer` for bodies |

## Forbidden (do not ship)

- Raw `fetch` / hand-rolled retry loops for JSON/HTTP APIs  
- Dual helpers (`json` vs `form`, `methodJson` vs `methodForm`)  
- Dynamic path routers (`/${method}`)  
- Path strings inside tools or module `execute`  
- Parallel HTTP client types per vendor  
- Defaulting every call to `throwOnError: false` without a documented envelope reason  

## Allowed exceptions

| Case | Tooling |
| --- | --- |
| SigV4 (S3-compatible, Textract, SQS, …) | **aws4fetch** only — see `storage/providers/s3.ts`, `document-extract/providers/textract.ts` |
| Allowlisted free-form HTTP module | `web-fetch` only; still uses `createServiceFetch` |

## Provider coverage

| Surface | Client | Service pattern |
| --- | --- | --- |
| email / cloudflare | ofetch | `createCloudflareEmailService` |
| email / resend | ofetch | `createResendService` ← **gold** |
| storage / r2 | ofetch | `createR2RestService` |
| storage / supabase | ofetch | `createSupabaseStorageService` ← **gold** |
| file-convert / transmute | ofetch | `createTransmuteService` |
| web-fetch | ofetch | free-form + `throwOnError: false` |
| channels / telegram | ofetch | must match gold (same endpoint style) |
| storage / s3 | aws4fetch | SigV4 |
| document-extract / textract | aws4fetch | SigV4 |

## Rules

- Recreate the service per execute (cheap); close over current `ctx` / auth.  
- Never put credentials on tool inputs.  
- Prefer native bulk APIs inside the service; batch tools stay in module ops.  
- Envelope quirks (e.g. `{ ok: false, description }`) are parsed **after** `serviceRequestJson`, not via a second HTTP stack.  
