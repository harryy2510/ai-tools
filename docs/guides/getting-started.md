# Getting started

## Install

```bash
bun add @harryy/ai-tools
```

Optional peer packages (only if you use the matching adapter):

```bash
bun add @mastra/core          # /mastra
bun add ai                    # /ai-sdk  (Vercel AI SDK)
bun add @tanstack/ai          # /tanstack
bun add @modelcontextprotocol/sdk   # registerMcpTools only
```

Runtime engines: **Bun ≥ 1.3.14** or **Node ≥ 24**. Edge runtimes work for modules marked `runtime: 'both'` or `'edge'`.

## Import map

There is **no root barrel**. Import by subpath:

| Subpath | Role |
| --- | --- |
| `@harryy/ai-tools/core` | Kernel |
| `@harryy/ai-tools/http` | HTTP factory |
| `@harryy/ai-tools/mastra` | Mastra projector |
| `@harryy/ai-tools/ai-sdk` | AI SDK projector |
| `@harryy/ai-tools/tanstack` | TanStack AI projector |
| `@harryy/ai-tools/cloudflare` | Workers AI tool definitions |
| `@harryy/ai-tools/mcp` | MCP list/call + register |
| `@harryy/ai-tools/cloudflare-email` | Product module |
| `@harryy/ai-tools/s3-storage` | Product module |
| `@harryy/ai-tools/mime` | Product module |

## Minimal kernel tool

```ts
import { z } from 'zod'
import { defineModule, defineTool, runTool } from '@harryy/ai-tools/core'

const ping = defineTool({
  id: 'demo-ping',
  name: 'ping',
  description: 'Return ok. Use as a connectivity check.',
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.literal(true) }),
  execute: async () => ({ ok: true as const }),
})

const demo = defineModule({
  id: 'demo',
  title: 'Demo',
  description: 'Demo module.',
  tools: [ping],
})

await runTool(ping, {})
// { ok: true }
```

## Bind auth then project

Product modules with credentials use `withAuth` **before** adapters:

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { cloudflareEmailModule } from '@harryy/ai-tools/cloudflare-email'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(cloudflareEmailModule, {
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
})

const tools = createMastraTools(bound)
// pass `tools` into your Mastra agent
```

MIME has `auth: { type: 'none' }` — project the module directly without `withAuth`.

## Direct execution (tests / scripts)

```ts
import { runTool, withAuth } from '@harryy/ai-tools/core'
import { sendEmailTool, cloudflareEmailModule } from '@harryy/ai-tools/cloudflare-email'

const bound = withAuth(cloudflareEmailModule, { accountId: '…', apiToken: '…' })
const tool = bound.tools.find((t) => t.id === sendEmailTool.id)!

await runTool(
  tool,
  {
    to: 'user@example.com',
    from: 'noreply@your-domain.example',
    subject: 'Hello',
    text: 'Hi',
  },
  { fetch: customFetch }, // optional injectable fetch
)
```

## Next

- [Auth and binding](./auth-and-binding.md)
- [Adapters](./adapters.md)
- [Product modules](../README.md#product-modules)
