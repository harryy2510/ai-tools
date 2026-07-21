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

- Product modules: [cloudflare-email](../modules/cloudflare-email.md), [s3-storage](../modules/s3-storage.md) (R2)
- [Adapters guide](../guides/adapters.md)
