# `@harryy/ai-tools/cloudflare`

Project kernel tools into **Cloudflare Workers AI–style tool definitions** (JSON Schema + execute wiring). This is a definition projector, not a Cloudflare API client for email/R2 (see product modules).

## API

```ts
import {
  createCloudflareAiToolDefinition,
  createCloudflareAiTools,
} from '@harryy/ai-tools/cloudflare'
import type { CloudflareAiToolDefinition, CloudflareAiToolset } from '@harryy/ai-tools/cloudflare'
```

| Helper | Use |
| --- | --- |
| `createCloudflareAiToolDefinition` | One tool → definition object |
| `createCloudflareAiTools` | Module or list → toolset |

Schemas are projected to JSON Schema for Workers AI tool calling shapes.

## Related

- Product: [cloudflare-email](../modules/cloudflare-email.md) (vendor pack), [storage](../modules/storage.md) (`s3` R2 endpoint or `r2` Cloudflare REST)
- [Adapters guide](../guides/adapters.md)
