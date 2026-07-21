# @harryy/ai-tools

Reusable AI tools with **strict schemas** and **model-facing contracts**. Define once in the kernel; project to Mastra, Vercel AI SDK, TanStack AI, Cloudflare Workers AI, MCP, or direct Node/edge calls.

Includes the **brain** (kernel, HTTP factory, adapters, contracts), **module codegen**, and product modules: **Cloudflare Email**, **S3 storage**, and **MIME**.

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

| Import | Source | Role |
| --- | --- | --- |
| `@harryy/ai-tools/core` | `src/core` | kernel, contracts, catalog |
| `@harryy/ai-tools/http` | `src/http` | HTTP factory, auth applicators |
| `@harryy/ai-tools/mastra` | `src/adapters/mastra` | Mastra projector |
| `@harryy/ai-tools/ai-sdk` | `src/adapters/ai-sdk` | AI SDK projector |
| `@harryy/ai-tools/tanstack` | `src/adapters/tanstack` | TanStack AI projector |
| `@harryy/ai-tools/cloudflare` | `src/adapters/cloudflare` | Workers AI tool defs |
| `@harryy/ai-tools/mcp` | `src/adapters/mcp` | MCP list/call + register |
| `@harryy/ai-tools/cloudflare-email` | `src/modules/cloudflare-email` | Email Service REST send |
| `@harryy/ai-tools/s3-storage` | `src/modules/s3-storage` | S3-compatible object ops + signed URLs |
| `@harryy/ai-tools/mime` | `src/modules/mime` | Parse/build MIME |

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
bun run new-module <kebab-key> [--title …] [--description …] [--auth none|custom]
bun run build          # codegen + tsdown
bun run typecheck
```

### Scaffold a product module

```bash
bun run new-module weather --title "Weather" --description "Forecast tools."
# creates:
#   src/modules/weather/{index,module}.ts
#   test/modules/weather.test.ts
# then runs codegen so @harryy/ai-tools/weather is exported
```

### Publish

CI runs `check` + `build` on every push/PR (`.github/workflows/ci.yml`). Publishing is local only: connect npm (and GitHub Packages if you want) yourself, bump the version, then:

```bash
bun run release   # npm publish --access public
```

`prepublishOnly` runs `check` + `build` before the pack goes up. No CI token or publish workflow required.

See `AGENTS.md` for agent rules (behavior, quality, gates).
