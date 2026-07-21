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

## Release checklist (local)

Publishing is **local only**. CI does not publish.

1. Ensure `main` is green (`bun run check` + `bun run build`).
2. Update [CHANGELOG.md](../CHANGELOG.md): move `Unreleased` notes into a new version section with today’s date.
3. Bump `version` in `package.json` per the table above.
4. Commit: `chore: release vX.Y.Z` (or equivalent).
5. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z` (optional but recommended).
6. Authenticate to npm yourself (`npm login` or GitHub Packages config).
7. Publish: `bun run release` → runs `prepublishOnly` (`check` + `build`) then `npm publish --access public`.

Do not commit secrets. Do not put registry tokens in the repo or CI unless you later choose to automate publish.

## Dual registry (optional)

Default `publishConfig` targets the public npm registry. If you also publish to GitHub Packages, configure that in your user/org npmrc; do not hardcode tokens here.

## After 1.0

- Breaking changes require **major**.
- New features require **minor**.
- Fixes require **patch**.
- Tool id renames remain breaking majors.
