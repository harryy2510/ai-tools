# Changelog

All notable changes to `@harryy/ai-tools` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [docs/versioning.md](./docs/versioning.md) (0.x policy until 1.0).

## [Unreleased]

### Added

- Docs wiki under `docs/` (guides, brain packages, product modules).
- `CHANGELOG.md` and [docs/versioning.md](./docs/versioning.md) (0.x SemVer + release checklist).
- Module scaffold writes `docs/modules/<key>.md` stub.
- `.github/workflows/publish.yml` — npm publish via **Trusted Publisher (OIDC)**, no `NPM_TOKEN`.

### Changed

- CI check workflow: least-privilege permissions, Bun install cache, split steps, typecheck, pack dry-run, dist smoke asserts.
- Repository URL set to `https://github.com/harryy2510/ai-tools`.

## [0.0.1] - 2026-07-21

Initial public package surface.

### Added

- **Kernel (`@harryy/ai-tools/core`)** — `defineTool`, `defineModule`, `withAuth`, `runTool`, contracts, catalog, JSON Schema projection, stable `ToolError` codes.
- **HTTP factory (`@harryy/ai-tools/http`)** — fixed-origin `defineHttpApi` / `httpRequest` helpers.
- **Adapters** — Mastra, Vercel AI SDK, TanStack AI, Cloudflare Workers AI tool defs, MCP list/call + register.
- **Module codegen** — oxc-parser discovery of `src/modules/*` → `package.json` exports, tsdown entries, manifest, module keys.
- **Product modules**
  - `cloudflare-email` — transactional send via Cloudflare Email Service REST API.
  - `s3-storage` — list/get/put/delete/head/copy + presigned URLs (S3-compatible including R2/MinIO).
  - `mime` — parse/build RFC 822 MIME messages (attachments, headers).
- **Scaffold** — `bun run new-module <kebab-key>`.
- **Tooling** — Bun, oxfmt, type-aware oxlint, lefthook, tsdown, `bun run check` gate.
- **CI** — GitHub Actions check + build + pack dry-run on push/PR.

### Hardening (modules)

- Email: 5 MiB preflight, richer upstream error mapping.
- S3: object metadata on list, put size limit, copy, signed URLs, optional session token.
- MIME: richer parse fields; build-time attachments and custom headers.

[Unreleased]: https://github.com/harryy2510/ai-tools/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/harryy2510/ai-tools/releases/tag/v0.0.1
