# HttpService and AwsService

Shared transport classes. Product clients construct one and call **domain methods** only.

| File | Role |
| --- | --- |
| `http-service.ts` | `HttpService` — ofetch |
| `aws-service.ts` | `AwsService extends HttpService` — same API + SigV4 via aws4fetch |
| `transport-errors.ts` | Shared non-2xx / network → `ToolError` |
| `ofetch-client.ts` | **Legacy** free helpers wrapping `HttpService` |

## HttpService (ofetch)

```ts
import { HttpService } from '../../shared/http-service'

const http = new HttpService({
  baseURL: 'https://api.resend.com',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  label: 'Resend',
  signal,
})

await http.get('/emails')
await http.post('/emails', { from, to, subject })
await http.bytes('GET', '/file.bin')
await http.get('/x', { noThrow: true })
await http.get('/x', { allowStatuses: [404] })
```

| Method | Role |
| --- | --- |
| `query` | Parsed body (JSON/text via ofetch); default throw on non-2xx |
| `bytes` | `Uint8Array` body |
| `get` / `post` / `put` / `patch` / `delete` / `head` | Sugar over `query` |

## AwsService (HttpService + SigV4)

`AwsService` **extends** `HttpService`. Credentials build a signing `fetch` (sign then real fetch); everything else is inherited. Extra method: `sign` for presigned URLs.

```ts
import { AwsService } from '../../shared/aws-service'

const aws = new AwsService({
  accessKeyId,
  secretAccessKey,
  region: 'us-east-1',
  service: 's3',
  label: 'S3',
  sessionToken, // optional
  fetch, // optional injectable (tests)
  signal,
})

await aws.get('https://bucket.s3.us-east-1.amazonaws.com/key')
await aws.put(url, body, { headers: { 'content-type': 'text/plain' } })
await aws.bytes('GET', url)
await aws.sign(url, { method: 'GET', signQuery: true })
```

Retries: **off** (`retries: 0` on aws4fetch) — agent owns retry policy.

## Migration

1. Prefer `HttpService` / `AwsService` in **new** code.  
2. Migrate off `createServiceFetch` / `serviceRequestJson` / raw `AwsClient` when touching a pack.  
3. Product class clients construct the service in the constructor.
