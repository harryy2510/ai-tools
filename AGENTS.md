# @harryy/ai-tools

Reusable AI tools: one package, subpath exports, kernel-first modules, optional framework adapters. Hosts own secret storage; this package validates auth when declared.

Repository rules constrain agent behavior. They do not teach package usage (see README).

## Authority

- The user owns product decisions: which modules exist, public API shape, dependency and script changes.
- Do not invent tools, adapters, export surfaces, or defaults without an explicit request.
- Global agent policy still applies. This file only adds package-specific constraints.

## HARD RULES — never skip (agent must obey)

These override convenience, host inventory code, and “I’ll clean it up later.” Violation = stop and fix before any other work.

### R0 — Read order before any code change

1. This file (`AGENTS.md`)
2. `docs/reference/ofetch-services.md` (if the task touches network I/O)
3. `docs/specs/provider-seam.md` (Lane A) or `docs/specs/package-surface-architecture.md` (lanes / channels / vendors)
4. **Clone a gold file** (open it, match structure):
   - HTTP provider: `src/modules/email/providers/resend.ts` and/or `src/modules/storage/providers/supabase.ts`
   - Lane A module shell: `src/modules/email/module.ts` + `contracts.ts`
   - SigV4 only: `src/modules/storage/providers/s3.ts`

Do not invent a new layout, naming scheme, or HTTP stack.

### R1 — Consistency over invention

- **Same problem → same shape.** If resend/supabase/r2 already solve it, copy that shape. Do not introduce a second pattern.
- Host repos (e.g. Five Star) are **capability inventory only**. Never copy their file layout, function names, fetch loops, or client wrappers into this package.
- Do not add `json`/`form`/`methodJson`/`callTelegram`/generic-path routers on top of ofetch. ofetch already handles body types.
- Do not invent parallel clients (`TelegramHttp`, `rawFetch`, custom retry frameworks) unless the user explicitly orders that design.

### R2 — HTTP (non-SigV4) — ofetch only, fixed signature

Every non-SigV4 network call in modules, vendors, and channels:

```ts
// 1) Service factory (same signature as resend)
function createXService(auth: XAuth, ctx: ToolContext) {
  const http = createServiceFetch({ baseURL: '…', headers: { … } }, ctx)
  return {
    // 2) Named endpoint → one serviceRequestJson / serviceRequestBytes call each
    sendMessage: (body: Record<string, unknown>) =>
      serviceRequestJson(http, 'Telegram sendMessage', '/sendMessage', {
        method: 'POST',
        body
      })
  }
}

// 3) Ops / domain map tool I/O → svc.endpoint only (no paths here)
```

**Forbidden:**

| Forbidden | Use instead |
| --- | --- |
| Raw `fetch` / `globalThis.fetch` loops | `createServiceFetch` + `serviceRequestJson` / `serviceRequestBytes` |
| Dynamic `/${method}` or body-type dual helpers (`json` + `form`) | One explicit endpoint method per API path; pass body through |
| Path strings in tools or module execute | Only inside `createXService` endpoint methods |
| New HTTP helper modules for a single vendor | Pattern above in the provider/channel file |
| `throwOnError: false` by default on every call | Default throw-on-error; only set `false` when the API returns a useful error body that must be parsed (document why on that call) |

**Allowed exception:** `aws4fetch` for SigV4 only (S3-compatible, Textract, SQS, …).

### R3 — File layout

| Lane | Layout (do not freestyle) |
| --- | --- |
| Platform module | `src/modules/<key>/{contracts,module,index}.ts` + `providers/<provider>.ts` |
| Vendor pack | `src/vendors/<key>/{…}` same idea; vendor-named tools ok |
| Channel pack | `src/channels/<key>/{contracts,module,index,webhook}.ts` + HTTP via same ofetch service pattern **in one implementation file** (not a second custom HTTP framework) |
| Shared pure helpers | `src/shared/*` only if used by 2+ surfaces |

- One public `index.ts` re-exports. Codegen owns package exports.
- Do not split the same provider into invent-as-you-go `service.ts` + `client.ts` + `http.ts` unless an existing gold module already does that exact split (none do for ofetch — service factory + ops live together like resend).

### R4 — Auth and tools

- Auth only via `withAuth` / `ctx.auth` / `requireAuth`. Never on tool inputs.
- Tool ids: stable kebab-case (`email-send`, `telegram-send-text`).
- Model-facing descriptions: what/when/bounds only — no secrets, env, vault, host wiring.
- Lane A: capability tools + `defineProvider` + ops type class. See provider-seam.
- Channels/vendors: full surface; package-owned names; host is inventory only.

### R5 — Before writing new code

1. Name the gold file you are cloning.
2. Name the ofetch service factory and each endpoint method (or state SigV4).
3. If you cannot point at an existing file with the same shape, **stop and ask** — do not invent.

### R6 — Gate

- Session-touched paths only for format: `oxfmt --write <paths>`
- Done means `bun run check` green. No `--no-verify`. No “tests later.”

## Architecture locks

- **Single package, subpath imports only.** No root mega-barrel that pulls every module.
- **Three surface lanes** (see `docs/specs/package-surface-architecture.md`):
  - `src/modules/*` — **platform capabilities** (generic tools + multi-provider seam)
  - `src/vendors/*` — **vendor packs** (full first-party API surfaces; vendor-named ok)
  - `src/channels/*` — **product messaging** (tools + webhook verify/parse; host owns durable turns)
- **Source layout (also):**
  - `src/core` — kernel (`defineTool`, `defineModule`, `defineProvider`, `withAuth`)
  - `src/http` — HTTP factory
  - `src/adapters/*` — framework projectors (Mastra, AI SDK, TanStack, Cloudflare AI, MCP)
  - `src/shared` — cross-cutting pure helpers (ofetch services, artifacts, batch)
- **Public import paths stay flat** (`@harryy/ai-tools/mastra`, `@harryy/ai-tools/email`, `@harryy/ai-tools/telegram`), even when source lives under `adapters/`, `modules/`, `vendors/`, or `channels/`.
- **Platform modules (Lane A):** capability-named tools (`email-send`); providers under `providers/*.ts`; host selects via auth `{ provider: '…', … }`. See `docs/specs/provider-seam.md`. Do **not** name a platform module after one cloud vendor (`cloudflare-email` forbidden).
- **Vendor packs (Lane B):** vendor-named modules and tool ids are allowed (`woocommerce-list-orders`). Map real APIs incrementally; do not force fat APIs into tiny generic commerce facades.
- **Channels (Lane C):** own API client, outbound tools, and webhook verify/parse helpers. Host owns routes, secrets storage, tenant mapping, outbox, authZ, audit.
- **Composio/Nango stay host SaaS OAuth catalog + PHI routing.** This package does not replace them.
- **Kernel is the source of truth.** Authors write `defineModule` / `defineTool` / `defineProvider` / `defineHttpApi` only. Do not hand-write framework tool shapes inside modules/vendors/channels.
- **Adapters are generic projectors only.** Never per-module adapter factories.
- **Prefer `es-toolkit` / `es-toolkit/compat`** for list/object/string helpers over hand-rolled typeof/array boilerplate.
- **Auth is host-bound only.** `withAuth` + `ctx.auth`. Never put credentials on model-facing tool inputs/outputs/descriptions. Nested credentials (e.g. convert → storage) stay in the host auth bag.
- **Batch, pagination, rate limits** are first-class where the domain allows.
- **HTTP (mandatory for non-SigV4):** ofetch service pattern is **first priority** for modules, vendors, and channels. See `docs/reference/ofetch-services.md`.
  1. `createServiceFetch` (baseURL + host headers + `ctx`)
  2. Named `createXService(auth, ctx)` with **endpoint methods only**
  3. Domain client/ops map I/O onto those methods — **no raw `fetch` loops, no path strings in tools/modules**
  - **aws4fetch** is the only intentional exception (SigV4: S3-compatible, Textract, SQS, …).
  - Prefer REST/S3 over Workers-only bindings as primary providers.
- **Do not add free-form “call any URL” agent tools** unless the product module is explicitly allowlisted (`web-fetch`).
- **Tool ids are stable kebab-case.** Changing a published id is a breaking change.
- **Runtime claims are honest.** `node` | `edge` | `both` must match actual imports and APIs. Node-only code must not claim edge.
- **`dist/` is build output only.** Never hand-edit. Emit via package build script only.
- **Surface is codegen-owned.** Add entries under `src/modules|vendors|channels/<kebab-key>/` with `index.ts`. Run `bun run codegen` (also via `build`). Do not hand-edit `package.json` `exports`, `tsdown.config.ts`, `generated/module-manifest.json`, or `src/generated/module-keys.ts` (codegen must discover all three lanes when vendors/channels exist).

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
- Prefer installed vendor SDKs or the shared ofetch service layer over ad-hoc fetch soup.
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
