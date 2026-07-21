# `@harryy/ai-tools/http`

Fixed-origin HTTP helpers for capability modules. Prefer this over free-form “call any URL” agent tools.

## Exports

```ts
import {
  httpRequest,
  defineHttpApi,
  bearerAuthSchema,
  applyApiKeyHeader,
  applyBasicAuth,
  applyBearerAuth,
  collectPages,
  mergePages,
} from '@harryy/ai-tools/http'
```

## `httpRequest`

```ts
const { data, status } = await httpRequest(
  {
    baseUrl: 'https://api.example.com',
    method: 'POST',
    path: '/v1/things',
    headers: { Authorization: `Bearer ${token}` },
    body: { hello: 'world' },
    query: { page: 1 },
    timeoutMs: 30_000,
    signal,
    fetchImpl: customFetch,
  },
  ctx,
)
```

Behavior:

- Joins `baseUrl` + `path`, applies query string.
- JSON-encodes body for non-GET when `body` is set.
- Default timeout 30s; cooperates with `AbortSignal`.
- Maps HTTP statuses to `ToolError` codes (`bad_auth`, `forbidden`, `not_found`, `rate_limited`, `upstream`, `timeout`).
- Parses JSON responses when possible; otherwise returns text.

## `defineHttpApi`

Factory for fixed-origin API modules (shared base URL + auth applicator + actions). Use when a product module is mostly REST over one vendor origin.

## Auth applicators

- `applyBearerAuth` / `applyBasicAuth` / `applyApiKeyHeader` — build request headers from host credentials without putting secrets on model-facing tool inputs.
- `bearerAuthSchema` — common Zod shape for bearer tokens.

## Pagination

- `collectPages` / `mergePages` — helpers for page-token style APIs when building tools that must not invent free-form crawl agents.

## Design rules

- **Fixed origin** per integration (Cloudflare API, etc.).
- Auth headers come from host-bound `ctx.auth`, not tool inputs.
- Do not log request Authorization headers.

## Related

- [cloudflare-email](../modules/cloudflare-email.md) uses `httpRequest`
- [Errors](../guides/errors.md)
