# @harryy/ai-tools

Reusable **AI tools** with strict Zod schemas and model-facing contracts. Define once in the kernel; project to **Mastra**, **Vercel AI SDK**, **TanStack AI**, **Cloudflare Workers AI**, **MCP**, or call directly.

[![ci](https://github.com/harryy/ai-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/harryy/ai-tools/actions/workflows/ci.yml)

**Docs wiki:** [docs/README.md](./docs/README.md) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **SemVer:** [docs/versioning.md](./docs/versioning.md)

## Why

- **One authoring path** — `defineTool` / `defineModule` only; adapters never re-implement business logic.
- **Host-owned secrets** — auth schemas + `withAuth`; model inputs never carry API keys.
- **Subpath imports** — tree-shake friendly; no root mega-barrel.
- **Honest runtimes** — `node` | `edge` | `both`.
- **Stable tool ids** — kebab-case ids safe for agents and MCP names.
- **Product modules included** — Cloudflare Email, S3-compatible storage, MIME parse/build.

## Install

```bash
bun add @harryy/ai-tools

# optional peers for adapters you use:
bun add @mastra/core
bun add ai
bun add @tanstack/ai
bun add @modelcontextprotocol/sdk   # registerMcpTools only
```

Requires **Bun ≥ 1.3.14** or **Node ≥ 24**.

## Quick start

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { cloudflareEmailModule } from '@harryy/ai-tools/cloudflare-email'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(cloudflareEmailModule, {
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
})

export const tools = createMastraTools(bound)
```

No-auth module (MIME):

```ts
import { mimeModule } from '@harryy/ai-tools/mime'
import { createAiSdkTools } from '@harryy/ai-tools/ai-sdk'

export const tools = createAiSdkTools(mimeModule)
```

## Subpaths

### Brain

| Import | Role | Docs |
| --- | --- | --- |
| `@harryy/ai-tools/core` | Kernel, contracts, `withAuth`, `runTool` | [docs/packages/core.md](./docs/packages/core.md) |
| `@harryy/ai-tools/http` | Fixed-origin HTTP factory | [docs/packages/http.md](./docs/packages/http.md) |
| `@harryy/ai-tools/mastra` | Mastra projector | [docs/packages/mastra.md](./docs/packages/mastra.md) |
| `@harryy/ai-tools/ai-sdk` | Vercel AI SDK projector | [docs/packages/ai-sdk.md](./docs/packages/ai-sdk.md) |
| `@harryy/ai-tools/tanstack` | TanStack AI projector | [docs/packages/tanstack.md](./docs/packages/tanstack.md) |
| `@harryy/ai-tools/cloudflare` | Workers AI tool defs | [docs/packages/cloudflare.md](./docs/packages/cloudflare.md) |
| `@harryy/ai-tools/mcp` | MCP list/call + register | [docs/packages/mcp.md](./docs/packages/mcp.md) |

### Product modules

| Import | Tools (ids) | Docs |
| --- | --- | --- |
| `@harryy/ai-tools/cloudflare-email` | `cloudflare-email-send` | [docs/modules/cloudflare-email.md](./docs/modules/cloudflare-email.md) |
| `@harryy/ai-tools/s3-storage` | `s3-list-objects`, `s3-get-object`, `s3-put-object`, `s3-delete-object`, `s3-head-object`, `s3-copy-object`, `s3-create-signed-url` | [docs/modules/s3-storage.md](./docs/modules/s3-storage.md) |
| `@harryy/ai-tools/mime` | `mime-parse`, `mime-build` | [docs/modules/mime.md](./docs/modules/mime.md) |

## Architecture

```text
defineTool / defineModule     ← author once (kernel)
        │
   withAuth(module, secrets)  ← host closes credentials
        │
   ┌────┴────────────────────────────┐
   │  adapters (projectors only)     │
   │  Mastra · AI SDK · TanStack ·   │
   │  Cloudflare AI · MCP · runTool  │
   └─────────────────────────────────┘
```

Full guides: [Getting started](./docs/guides/getting-started.md) · [Auth](./docs/guides/auth-and-binding.md) · [Adapters](./docs/guides/adapters.md) · [Authoring](./docs/guides/authoring-modules.md) · [Errors](./docs/guides/errors.md)

## Develop

```bash
bun install
bun run hooks:install
oxfmt --write <touched-paths>
bun run check          # format:check + lint + codegen:check + test
bun run codegen        # discover src/modules/* → exports / tsdown / manifest
bun run new-module <kebab-key> [--title …] [--description …] [--auth none|custom]
bun run build
bun run typecheck
```

CI runs the same check + build + pack dry-run on every push/PR (see `.github/workflows/ci.yml`).

## Publish (local)

1. Update [CHANGELOG.md](./CHANGELOG.md) and bump `version` per [docs/versioning.md](./docs/versioning.md).
2. Log in to npm yourself.
3. `bun run release` → `prepublishOnly` (`check` + `build`) then `npm publish --access public`.

No CI token is required for publish.

## License

[MIT](./LICENSE) © harryy
