# @harryy/ai-tools wiki

Documentation hub for the package. Source of truth for architecture and module contracts; the root [README](../README.md) is the short entry point.

## Start here

| Page | Purpose |
| --- | --- |
| [Getting started](./guides/getting-started.md) | Install, import map, first bound module |
| [Auth and binding](./guides/auth-and-binding.md) | Host-owned secrets, `withAuth`, model-facing rules |
| [Adapters](./guides/adapters.md) | Project kernel tools into frameworks |
| [Authoring modules](./guides/authoring-modules.md) | `defineModule` / scaffold / codegen |
| [Errors](./guides/errors.md) | `ToolError` codes and retry signals |
| [Versioning](./versioning.md) | semantic-release + conventional commits |
| [Changelog](../CHANGELOG.md) | Released notes |

## Brain packages

| Import | Doc |
| --- | --- |
| `@harryy/ai-tools/core` | [core](./packages/core.md) |
| `@harryy/ai-tools/http` | [http](./packages/http.md) |
| `@harryy/ai-tools/mastra` | [mastra](./packages/mastra.md) |
| `@harryy/ai-tools/ai-sdk` | [ai-sdk](./packages/ai-sdk.md) |
| `@harryy/ai-tools/tanstack` | [tanstack](./packages/tanstack.md) |
| `@harryy/ai-tools/cloudflare` | [cloudflare](./packages/cloudflare.md) |
| `@harryy/ai-tools/mcp` | [mcp](./packages/mcp.md) |

## Product modules

| Import | Doc |
| --- | --- |
| `@harryy/ai-tools/cloudflare-email` | [cloudflare-email](./modules/cloudflare-email.md) |
| `@harryy/ai-tools/s3-storage` | [s3-storage](./modules/s3-storage.md) |
| `@harryy/ai-tools/mime` | [mime](./modules/mime.md) |

## Mental model

```text
Host app
  ├── owns secrets / vaults
  ├── withAuth(module, credentials)   // closes auth into tools
  └── adapter projector               // Mastra | AI SDK | TanStack | CF | MCP | runTool
        └── kernel ToolDefinition     // id, schemas, execute, meta
              └── product module or custom defineTool
```

- **Kernel** is the only place tools are authored.
- **Adapters** only project; they never re-implement vendor calls.
- **Auth schemas** are host-facing; model-facing tool inputs never include keys or tokens.
- **Codegen** owns package exports for product modules under `src/modules/<key>/`.

## Contributing notes

Agent/contributor rules live in [AGENTS.md](../AGENTS.md). Prefer changing docs in the same PR as behavior when public contracts move.
