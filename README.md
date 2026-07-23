# @harryy/ai-tools

Reusable **AI tools** with strict Zod schemas and model-facing contracts. Define once in the kernel; project to **Mastra**, **Vercel AI SDK**, **TanStack AI**, **Cloudflare Workers AI**, **MCP**, or call directly.

[![ci](https://github.com/harryy2510/ai-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/harryy2510/ai-tools/actions/workflows/ci.yml)
[![release](https://github.com/harryy2510/ai-tools/actions/workflows/release.yml/badge.svg)](https://github.com/harryy2510/ai-tools/actions/workflows/release.yml)

**Docs wiki:** [docs/README.md](./docs/README.md) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **Release:** [docs/versioning.md](./docs/versioning.md)

## Why

- **One authoring path** — `defineTool` / `defineModule` only; adapters never re-implement business logic.
- **Host-owned secrets** — auth schemas + `withAuth`; model inputs never carry API keys.
- **Subpath imports** — tree-shake friendly; no root mega-barrel.
- **Honest runtimes** — `node` | `edge` | `both`.
- **Stable tool ids** — kebab-case ids safe for agents and MCP names.
- **Capability modules + provider seam** — generic tools (`email`, `storage`, …); host picks provider via auth union.
- **Product modules included** — email, storage, document extract, file convert, MIME, content-type, web-fetch.

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
import { resendModule, ResendClient } from '@harryy/ai-tools/resend'
import { createMastraTools } from '@harryy/ai-tools/mastra'

// Host DX (class client)
const resend = new ResendClient({ api_key: process.env.RESEND_API_KEY! })
await resend.send({ to: 'a@example.com', from: 'b@example.com', subject: 'Hi', text: 'Hello' })

// Agent tools
const bound = withAuth(resendModule, { api_key: process.env.RESEND_API_KEY! })
export const tools = createMastraTools(bound)
```

No-auth module (MIME):

```ts
import { emailMessageModule } from '@harryy/ai-tools/email-message'
import { createAiSdkTools } from '@harryy/ai-tools/ai-sdk'

export const tools = createAiSdkTools(emailMessageModule)
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
| `@harryy/ai-tools/resend` | `resend-send`, `resend-send-batch` (vendor pack) | [docs/modules/resend.md](./docs/modules/resend.md) |
| `@harryy/ai-tools/cloudflare-email` | `cloudflare-email-send`, `cloudflare-email-send-batch` (vendor pack) | [docs/modules/cloudflare-email.md](./docs/modules/cloudflare-email.md) |
| `@harryy/ai-tools/telegram` | Telegram messaging pack | [docs/modules/telegram.md](./docs/modules/telegram.md) |
| `@harryy/ai-tools/storage` | `storage-*` + batch — providers: `s3`, `r2` (CF REST), `supabase` | [docs/modules/storage.md](./docs/modules/storage.md) |
| `@harryy/ai-tools/email-message` | `email-message-parse`, `email-message-build` | [docs/modules/email-message.md](./docs/modules/email-message.md) |
| `@harryy/ai-tools/content-type` | `content-type-get`, `content-type-extension`, `content-type-extensions` | [docs/modules/content-type.md](./docs/modules/content-type.md) |
| `@harryy/ai-tools/web-fetch` | `web-fetch-get` (read), `web-fetch-request` (write) | [docs/modules/web-fetch.md](./docs/modules/web-fetch.md) |
| `@harryy/ai-tools/document-extract` | `document-extract-text`, `document-extract-status`, `document-extract-text-batch` | [docs/modules/document-extract.md](./docs/modules/document-extract.md) |
| `@harryy/ai-tools/file-convert` | `file-convert`, `file-convert-batch` | [docs/modules/file-convert.md](./docs/modules/file-convert.md) |

## Architecture

```text
defineTool / defineModule / defineProvider
        │
   withAuth(module, { provider, … })  ← host closes credentials
        │
   resolveProvider → ops (type class)
        │
   adapters (Mastra · AI SDK · TanStack · CF · MCP · runTool)
```

Provider seam: [docs/specs/provider-seam.md](./docs/specs/provider-seam.md).

Full guides: [Getting started](./docs/guides/getting-started.md) · [Auth](./docs/guides/auth-and-binding.md) · [Adapters](./docs/guides/adapters.md) · [Authoring](./docs/guides/authoring-modules.md) · [Errors](./docs/guides/errors.md)

## Develop

```bash
bun install
bun run hooks:install
oxfmt --write <touched-paths>
bun run check          # format:check + lint + codegen:check + test
bun run codegen
bun run new-module <kebab-key> [--title …] [--description …] [--auth none|custom]
bun run build
bun run typecheck
```

## Document extract & convert (self-host)

- **Artifacts** are S3 keys (`ArtifactRef`), not base64 in the model. Spec: [docs/specs/artifacts-extract-convert.md](./docs/specs/artifacts-extract-convert.md).
- **Extract:** Amazon Textract (sync poll inside the tool; `pending` + `job_id` if wait budget expires, then `document-extract-status`). Object must live in **AWS S3** (Textract `S3Object`).
- **Convert:** Self-host **[Transmute](https://github.com/transmute-app/transmute)** (private, offline relative to SaaS converters, REST API). `file-convert` uploads → converts → writes result back to S3.

## Release

**[semantic-release](https://semantic-release.gitbook.io/)** on `main` from **conventional commits**. No manual version bump.

| Commit | Version |
| --- | --- |
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| `BREAKING CHANGE` / `type!:` | major |

Merge to `main` → `release.yml` runs check/build → tags → npm via **OIDC Trusted Publisher** (workflow file must be **`release.yml`**). Details: [docs/versioning.md](./docs/versioning.md).

```bash
bun run release:dry   # local dry-run only
```

## License

[MIT](./LICENSE) © harryy
