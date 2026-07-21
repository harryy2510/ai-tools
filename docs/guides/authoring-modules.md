# Authoring modules

## Layout

```text
src/modules/<kebab-key>/
  index.ts    # public re-exports (codegen entry)
  module.ts   # defineModule + tools
test/modules/<kebab-key>.test.ts
docs/modules/<kebab-key>.md   # wiki page (add/update with the module)
```

Folder name = package subpath: `@harryy/ai-tools/<kebab-key>`.

## Scaffold

```bash
bun run new-module weather --title "Weather" --description "Forecast tools." --auth none
# or --auth custom
```

Creates sources + test, formats, runs codegen.

## Manual shape

```ts
import { z } from 'zod'
import { defineModule, defineTool } from '@harryy/ai-tools/core' // in-repo: relative to src/core

export const weatherModule = defineModule({
  id: 'weather',
  title: 'Weather',
  description: 'Forecast tools.',
  runtime: 'both',
  auth: { type: 'none' },
  tools: [
    defineTool({
      id: 'weather-get',
      name: 'getWeather',
      description: 'Get current conditions for a city. Returns temperature C and summary.',
      inputSchema: z.object({
        city: z.string().min(1).describe('City name'),
      }),
      outputSchema: z.object({
        temperature_c: z.number(),
        summary: z.string(),
      }),
      sideEffect: 'read',
      runtime: 'both',
      execute: async (input) => {
        // call vendor / httpRequest
        return { temperature_c: 20, summary: 'Clear' }
      },
    }),
  ],
})
```

Then `bun run codegen` so exports and tsdown pick up the module.

## Contracts checklist

- Tool `id`: stable **kebab-case** (`weather-get`). Changing a published id is breaking.
- `description` and input `.describe()`: **model selection and argument filling only**.
- `runtime`: honest (`node` | `edge` | `both`).
- `sideEffect`: `none` | `read` | `write` | `delete` | `send`.
- Prefer `defineHttpApi` / `httpRequest` for fixed-origin REST.
- Prefer `es-toolkit` for object/list helpers.
- Fail with `ToolError` and stable codes; never leak secrets.
- Tests mock network; do not require live keys for `bun run check`.

## Codegen ownership

Do **not** hand-edit:

- `package.json` → `exports` (module entries)
- `tsdown.config.ts` entry map
- `generated/module-manifest.json`
- `src/generated/module-keys.ts`

Run `bun run codegen` (also part of `build`). `codegen:check` fails CI on drift.

## Docs

When adding or changing a product module, update:

1. `docs/modules/<key>.md`
2. `docs/README.md` module table
3. Root `README.md` subpath table if present
4. `CHANGELOG.md` under Unreleased
