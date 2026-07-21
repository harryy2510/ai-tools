# @harryy/ai-tools

Reusable AI tools with **strict schemas** and **model-facing contracts**. Define once in the kernel; project to Mastra, Vercel AI SDK, TanStack AI, Cloudflare Workers AI, MCP, or direct Node/edge calls.

Product tools are not included yet — this release is the **brain** (kernel, HTTP factory, adapters, contracts) plus **module codegen** (oxc-parser discovery → package exports / tsdown entry).

## Install

```bash
bun add @harryy/ai-tools
# optional adapters:
bun add @mastra/core
bun add ai
bun add @tanstack/ai
# optional for registerMcpTools hosts:
bun add @modelcontextprotocol/sdk
```

## Subpaths

| Import | Role |
| --- | --- |
| `@harryy/ai-tools/core` | `defineTool`, `defineModule`, `withAuth`, `runTool`, contracts, catalog |
| `@harryy/ai-tools/http` | `defineHttpApi`, auth applicators, pagination helpers |
| `@harryy/ai-tools/mastra` | `createMastraTool(s)` |
| `@harryy/ai-tools/ai-sdk` | `createAiSdkTool(s)` |
| `@harryy/ai-tools/tanstack` | `createTanStackTool(s)` |
| `@harryy/ai-tools/cloudflare` | Workers AI traditional tool defs + executors |
| `@harryy/ai-tools/mcp` | MCP list/call helpers + `registerMcpTools` |

## Kernel sketch

```ts
import { z } from 'zod'
import { defineModule, defineTool, withAuth } from '@harryy/ai-tools/core'
import { createMastraTools } from '@harryy/ai-tools/mastra'
import { createAiSdkTools } from '@harryy/ai-tools/ai-sdk'
import { createTanStackTools } from '@harryy/ai-tools/tanstack'
import { createCloudflareAiTools } from '@harryy/ai-tools/cloudflare'
import { createMcpTools, registerMcpTools } from '@harryy/ai-tools/mcp'

const module = defineModule({
  id: 'demo',
  title: 'Demo',
  description: 'Demo module.',
  tools: [
    defineTool({
      id: 'demo-ping',
      name: 'ping',
      description: 'Return ok. Use as a connectivity check.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true) }),
      execute: async () => ({ ok: true as const }),
    }),
  ],
})

// no auth → project directly; with auth → withAuth(module, secrets) first
createMastraTools(module)
createAiSdkTools(module)
createTanStackTools(module)
createCloudflareAiTools(module)
createMcpTools(module)
// registerMcpTools(mcpServer, module) // host-owned McpServer from the MCP SDK
```

## Tooling

```bash
bun install
bun run hooks:install
oxfmt --write <touched-paths>
bun run check          # format + lint + codegen:check + tests
bun run codegen        # discover src/modules/* → exports / tsdown / manifest
bun run build          # codegen + tsdown
bun run typecheck
```

### Adding a product module later

1. Create `src/modules/<kebab-key>/index.ts` (and implementation).
2. Run `bun run codegen` (or `bun run build`).
3. Subpath `@harryy/ai-tools/<kebab-key>` is generated automatically.

See `AGENTS.md` for agent rules (behavior, quality, gates).
