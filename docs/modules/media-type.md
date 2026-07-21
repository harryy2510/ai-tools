# Media Type

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/media-type` |
| **Module id** | `media-type` |
| **Runtime** | `both` |
| **Auth** | **none** |
| **Library** | [`mime`](https://www.npmjs.com/package/mime) (mime-db) |

MIME type ↔ file extension lookup. **Not** email MIME messages — those are in [mime](./mime.md) (`mime-parse` / `mime-build`).

## Install / import

```ts
import {
  mediaTypeModule,
  mediaTypeGetTool,
  mediaTypeExtensionTool,
  mediaTypeExtensionsTool
} from '@harryy/ai-tools/media-type'
```

No `withAuth` required.

## Tools

### `media-type-get` (`getMediaType`) — sideEffect `none`

| Input | Notes |
| --- | --- |
| `path` | File path, filename, or extension (`report.pdf`, `pdf`, `.txt`) |

| Output | Notes |
| --- | --- |
| `media_type` | MIME string or `null` when unknown |

### `media-type-extension` (`getMediaExtension`) — sideEffect `none`

| Input | Notes |
| --- | --- |
| `media_type` | MIME type; charset is ignored |

| Output | Notes |
| --- | --- |
| `extension` | Preferred extension without a leading dot, or `null` |

### `media-type-extensions` (`getMediaExtensions`) — sideEffect `none`

Same input as `media-type-extension`. Returns `extensions: string[]` (all known aliases, empty when unknown).

## Internal reuse

`file-convert` (and other modules) import helpers from the same `mime` package via `src/shared/media-type.ts` — no hand-rolled extension tables.
