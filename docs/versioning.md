# Versioning and release

Package: `@harryy/ai-tools`  
Tool: **[semantic-release](https://semantic-release.gitbook.io/)** on `main`.

## How it works

**Conventional commits** are the only automatic signal for the next version.

| Commit | Release |
| --- | --- |
| `feat:` / `feat(scope):` | **minor** |
| `fix:` / `perf:` / `revert:` | **patch** |
| `BREAKING CHANGE:` in body or `type!:` | **major** |
| `chore:` `docs:` `test:` `ci:` `style:` `refactor:` `build:` | no release |

```text
push to main
  → ci.yml           (check / build quality gate)
  → release.yml      (check + build + semantic-release)
       → analyze commits since last git tag
       → bump package.json, update CHANGELOG.md
       → git tag + GitHub Release
       → npm publish via OIDC Trusted Publisher (no NPM_TOKEN)
```

If nothing releasable has landed since the last tag, semantic-release exits 0 and does nothing.

## One-time setup

### npm Trusted Publisher

1. npm package → **Trusted Publisher**
2. GitHub repo: `harryy2510/ai-tools`
3. Workflow file: **`release.yml`** (not `ci.yml`, not `publish.yml`)
4. Permission: `npm publish`

### Git tag for the version already on npm

`0.0.1` was published before semantic-release. Create a matching tag on the commit that matches that release so the next run does not re-publish `0.0.1`:

```bash
git tag v0.0.1 <commit-sha>   # if missing
git push origin v0.0.1
```

## Local

```bash
bun run release:dry    # dry-run (needs full git history + network for npm registry read)
bun run release        # real run — prefer CI; local needs npm auth
```

Prefer shipping via **merge to `main`** and let CI release.

## Commit style

```text
feat: add s3 copy object
fix: handle empty mime body
feat!: rename tool id weather-get

fix: correct list pagination

BREAKING CHANGE: listObjects no longer returns bare keys only.
```

Release commits from the bot look like:

```text
chore(release): 0.0.2 [skip ci]
```

Those do not trigger another release.

## Config

- `release.config.mjs` — plugins and rules  
- `.github/workflows/release.yml` — CI job  

## Public API (breaking = major)

Import paths, named exports, tool/module ids, auth field names, model-facing I/O fields, `ToolError.code`, false `runtime` claims.
