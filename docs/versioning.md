# Versioning and release policy

Package: `@harryy/ai-tools`  
Current line: **0.x** (pre-1.0).

## SemVer (0.x)

Until `1.0.0`, versions are `0.MINOR.PATCH`:

| Bump | When |
| --- | --- |
| **PATCH** (`0.0.x` → `0.0.x+1`) | Bug fixes, docs, tests, CI, internal refactors that do not change public TypeScript types or runtime contracts. |
| **MINOR** (`0.x` → `0.x+1.0`) | New modules, tools, adapters, options **or** intentional breaking changes while still on 0.x. |
| **MAJOR** (`1.0.0`) | First stability commitment. After 1.0, breaking changes require a major bump. |

On 0.x, **breaking changes are allowed in minor bumps**, but they must be called out under `### Breaking` in [CHANGELOG.md](../CHANGELOG.md). Prefer additive APIs when possible.

## What counts as public API

Breaking if you change any of these without a documented migration:

1. **Import paths** — e.g. `@harryy/ai-tools/core`, `@harryy/ai-tools/s3-storage`.
2. **Named exports** removed or type-incompatible.
3. **Tool `id` strings** (kebab-case ids used by agents/adapters) — renames are always breaking.
4. **Module `id` strings**.
5. **Auth schema field names** for host binding (`withAuth`).
6. **Model-facing input/output field names** on tools (Zod shapes agents fill).
7. **`ToolError.code` enum values** removed or repurposed.
8. **Runtime claims** that become false (tool marked `both` but requiring Node-only APIs).

Non-breaking:

- New optional input fields with defaults.
- New tools inside an existing module (additive; still note in CHANGELOG).
- New modules / new subpath exports.
- Stricter validation that only rejects previously invalid inputs.
- Richer error `details` objects.
- Docs and scaffolds.

## Release checklist (GitHub → npm, no token)

CI **check** runs on every push/PR (`.github/workflows/ci.yml`).  
**Publish** is a separate workflow (`.github/workflows/publish.yml`) using npm **Trusted Publisher** (OIDC). No `NPM_TOKEN` secret.

### One-time npm setup

1. On the npm package page → **Trusted Publisher**.
2. Link GitHub repo `harryy2510/ai-tools`.
3. Workflow file must be **`publish.yml`** (not `ci.yml`). Permissions: `npm publish`.
4. Save. No granular access token required for CI publish when OIDC is linked.

### Cut a release

1. Ensure `main` is green.
2. Update [CHANGELOG.md](../CHANGELOG.md); bump `version` in `package.json`.
3. Commit and push to `main`.
4. Create a GitHub Release (or tag and publish a release) for `vX.Y.Z` **or** run **Actions → publish → Run workflow**.
5. `publish.yml` runs `prepublishOnly` then `npm publish --access public --provenance` via OIDC.

### Local fallback

```bash
bun run release   # npm publish --access public (uses your logged-in npm user)
```

Do not put registry tokens in the repo. OIDC trusted publisher is the CI path.

## After 1.0

- Breaking changes require **major**.
- New features require **minor**.
- Fixes require **patch**.
- Tool id renames remain breaking majors.
