# Transport: HttpService and AwsService

`src/transport/` — ofetch HTTP + optional SigV4. That is the whole stack.

| File | Role |
| --- | --- |
| `http-service.ts` | `HttpService` |
| `aws-service.ts` | `AwsService extends HttpService` (signing fetch) |
| `errors.ts` | Status / network → `ToolError` |
| `index.ts` | Public `@harryy/ai-tools/http` re-exports |

Auth is just **headers** on the client:

```ts
new HttpService({
  baseURL: 'https://api.example.com',
  headers: { Authorization: `Bearer ${token}` },
  label: 'Example',
})
```

ofetch does not invent auth. You set headers (or AwsService signs). No separate auth-applicator layer.

```ts
import { HttpService } from '../../transport/http-service'

const http = new HttpService({ baseURL, headers, label: 'Resend', fetch, signal })
await http.post('/emails', body)
await http.bytes('GET', '/file')
await http.get('/x', { noThrow: true })
```

```ts
import { AwsService } from '../../transport/aws-service'

const aws = new AwsService({ accessKeyId, secretAccessKey, region, service: 's3', label: 'S3' })
await aws.put(url, body)
await aws.sign(url, { signQuery: true })
```

| Dir | Owns |
| --- | --- |
| `src/transport/` | HTTP only |
| `src/shared/` | `artifact`, `batch`, `bytes`, `media-type`, list `pagination` |
| `src/messaging/` | channel contracts + packs |
