# @harryy/ai-tools

Reusable AI tools: one package, subpath exports, kernel-first modules, optional framework adapters. Hosts own secret storage; this package validates auth when declared.

Repository rules constrain agent behavior. They do not teach package usage (see README).

## Authority

- The user owns product decisions: which modules exist, public API shape, dependency and script changes.
- Do not invent tools, adapters, export surfaces, or defaults without an explicit request.
- Global agent policy still applies. This file only adds package-specific constraints.

## Architecture locks

- **Single package, subpath imports only.** No root mega-barrel that pulls every module.
- **Source layout:**
  - `src/core` — kernel (`defineTool`, `defineModule`, `defineProvider`, `withAuth`)
  - `src/http` — HTTP factory
  - `src/adapters/*` — framework projectors (Mastra, AI SDK, TanStack, Cloudflare AI, MCP)
  - `src/modules/*` — **capability** modules (codegen-discovered), not vendor names
  - `src/shared` — cross-cutting pure helpers
- **Public import paths stay flat** (`@harryy/ai-tools/mastra`), even when source lives under `adapters/`.
- **Capability modules + provider seam.** Product modules are generic (`email`, `storage`, `document-extract`, `file-convert`). Vendor logic lives in `providers/*.ts` implementing one ops type class. Host selects provider via auth discriminated union `{ provider: '…', … }`. See `docs/specs/provider-seam.md`.
- **Never name a module or tool id after a single vendor** (`cloudflare-email`, `s3-get-object` are forbidden patterns).
- **Kernel is the source of truth.** Authors write `defineModule` / `defineTool` / `defineProvider` / `defineHttpApi` only. Do not hand-write framework tool shapes inside modules.
- **Adapters are generic projectors only.** Never per-module adapter factories.
- **Prefer `es-toolkit` / `es-toolkit/compat`** for list/object/string helpers over hand-rolled typeof/array boilerplate.
- **Auth is host-bound only.** `withAuth` + `ctx.auth`. Never put credentials on model-facing tool inputs/outputs/descriptions. Nested credentials (e.g. convert → storage) stay in the host auth bag.
- **Batch, pagination, rate limits** are first-class in seamed modules (single + batch tools; cursor list pages; `rate_limited` / `retryable` errors).
- **HTTP integrations are fixed-origin capability modules.** Prefer `defineHttpApi`. Do not add free-form “call any URL” agent tools unless the user explicitly requests that product.
- **Tool ids are stable kebab-case** (`email-send`). Changing a published id is a breaking change.
- **Runtime claims are honest.** `node` | `edge` | `both` must match actual imports and APIs. Node-only code must not claim edge.
- **`dist/` is build output only.** Never hand-edit. Emit via package build script only.
- **Module surface is codegen-owned.** Add modules under `src/modules/<kebab-key>/` with `index.ts`. Run `bun run codegen` (also via `build`). Do not hand-edit module entries in `package.json` `exports`, `tsdown.config.ts`, `generated/module-manifest.json`, or `src/generated/module-keys.ts`.

## Quality bars

### Model-facing contract

- `description` and input field `.describe()` are for **model selection and argument filling** only: what, when, bounds, side effect, result shape.
- Never put API keys, env var names, vault language, install steps, or host wiring in model-facing copy.
- Auth field descriptions are host-facing (schema for forms/validation), not agent tool args.

### Type safety (`src/`)

- No type assertions except unchained `as const` when required for literal inference.
- No `any`, non-null `!`, `@ts-ignore`, `@ts-expect-error`, or lint suppressions to dodge the rule.
- Untrusted boundaries use `unknown` + runtime narrowing (Zod, type guards).

### Implementation

- Named exports; lowercase kebab-case source filenames.
- Tree-shake friendly: leaf modules, no side-effect registration at import time.
- Prefer installed vendor SDKs or the shared HTTP factory over ad-hoc fetch soup.
- Fail with stable `ToolError` codes. Do not leak secrets, tokens, or raw credential material in errors.
- Default tests mock network. Do not require live provider calls for the main gate.

### Public surface

- **Brain packages** (`core`, `http`, adapters): edit source under `src/<name>/` and `scripts/codegen/brain.ts`, then `bun run codegen`.
- **Product modules**: prefer `bun run new-module <kebab-key>` (writes index/module/test/docs stub + codegen), or add `src/modules/<key>/index.ts` by hand then `bun run codegen`. Do not hand-wire package exports/tsdown/manifest.
- **Public docs wiki** lives under `docs/`. Update module/package pages when public contracts change. Versions/changelogs are produced by **semantic-release** from conventional commits (`docs/versioning.md`). Do not hand-bump `package.json` version for releases.

## Dependencies and tooling

- Package manager is **Bun**; versions are **exact** (`bunfig` + lockfile).
- Do not add, remove, upgrade, or downgrade dependencies, lockfile entries, or package scripts without explicit approval for that change.
- Formatter: **oxfmt**. Linter: **oxlint** type-aware (**oxlint-tsgolint**). Parser for codegen: **oxc-parser** (Rust). Build: **tsdown**. Hooks: **lefthook**.
- Do not introduce Prettier, ESLint, or Husky.

## Verification (package scripts)

Session work:

1. Format **only session-touched paths**: `oxfmt --write <paths>`  
   Do not use repo-wide `oxfmt --write .` / `bun run format` as the finishing step.
2. Before claiming a slice done, run the full gate:

```bash
bun run check
```

That is `format:check` + type-aware `lint` + `codegen:check` + `test` (same as pre-push).

3. If the public surface, build config, or emit shape changed, also run:

```bash
bun run build
bun run typecheck
```

| Script | Proves |
| --- | --- |
| `bun run check` | format + type-aware lint + codegen drift check + tests |
| `bun run codegen` | discover modules (oxc-parser) + write exports/tsdown/manifest |
| `bun run codegen:check` | generated surface is up to date |
| `bun run lint` | oxlint type-aware on `src` + `test` + `scripts` |
| `bun run format:check` | oxfmt clean |
| `bun run test` | unit tests |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run build` | codegen + tsdown ESM/declarations |
| `bun run hooks:install` | lefthook hooks after clone |

**Do not claim done if `bun run check` failed.** Fix session-caused failures; do not weaken configs to silence them. Do not bypass hooks with `--no-verify`.

Focused loop while editing is fine (`oxfmt` touched paths, narrow lint/test); **finish on `bun run check`**.

## Out of scope for this package

- Multi-tenant policy, PHI routing, vaults, WORM/audit products  
- Agent runtimes, allowlists, confirmation UX owned by hosts  
- Live network as default CI  
- Starting long-lived servers for verification  

## Slice discipline

- Prefer small vertical slices: contract → implementation → tests → gate green.
- Prefer `defineHttpApi` for fixed REST vendors before custom clients.
- Stop and ask when the request needs a new dependency, a public API break, free-form HTTP, or a product default not already locked here.
