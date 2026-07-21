# @harryy/ai-tools

Reusable AI tools: one package, subpath exports, kernel-first modules, optional framework adapters. Hosts own secret storage; this package validates auth when declared.

Repository rules constrain agent behavior. They do not teach package usage (see README).

## Authority

- The user owns product decisions: which modules exist, public API shape, dependency and script changes.
- Do not invent tools, adapters, export surfaces, or defaults without an explicit request.
- Global agent policy still applies. This file only adds package-specific constraints.

## Architecture locks

- **Single package, subpath imports only.** No root mega-barrel that pulls every module.
- **Kernel is the source of truth.** Authors write `defineModule` / `defineTool` / `defineHttpApi` only. Do not hand-write Mastra, AI SDK, or other framework tool shapes inside modules.
- **Adapters are generic projectors** (`createMastraTool` / `createMastraTools`). Never per-module adapter factories.
- **Auth is optional and host-bound.** Schema + `withAuth` only. Never store credentials. Never put auth fields on model-facing input schemas.
- **HTTP integrations are fixed-origin capability modules.** Prefer `defineHttpApi`. Do not add free-form “call any URL” agent tools unless the user explicitly requests that product.
- **Tool ids are stable kebab-case** (`weather-get`). Changing a published id is a breaking change.
- **Runtime claims are honest.** `node` | `edge` | `both` must match actual imports and APIs. Node-only code must not claim edge.
- **`dist/` is build output only.** Never hand-edit. Emit via package build script only.

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

A slice that adds or renames a public tool or subpath must update in the **same change**:

1. module source + tests  
2. `package.json` `exports`  
3. `tsdown.config.ts` `entry`  

## Dependencies and tooling

- Package manager is **Bun**; versions are **exact** (`bunfig` + lockfile).
- Do not add, remove, upgrade, or downgrade dependencies, lockfile entries, or package scripts without explicit approval for that change.
- Formatter: **oxfmt**. Linter: **oxlint** type-aware (**oxlint-tsgolint**). Build: **tsdown**. Hooks: **lefthook**.
- Do not introduce Prettier, ESLint, or Husky.

## Verification (package scripts)

Session work:

1. Format **only session-touched paths**: `oxfmt --write <paths>`  
   Do not use repo-wide `oxfmt --write .` / `bun run format` as the finishing step.
2. Before claiming a slice done, run the full gate:

```bash
bun run check
```

That is `format:check` + type-aware `lint` + `test` (same as pre-push).

3. If the public surface, build config, or emit shape changed, also run:

```bash
bun run build
bun run typecheck
```

| Script | Proves |
| --- | --- |
| `bun run check` | format + type-aware lint + tests (required finish gate) |
| `bun run lint` | oxlint type-aware on `src` + `test` |
| `bun run format:check` | oxfmt clean |
| `bun run test` | unit tests |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run build` | tsdown ESM + declarations |
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
