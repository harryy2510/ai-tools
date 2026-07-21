# @harryy/ai-tools

Reusable AI tools with **strict schemas** and **model-facing contracts**. **Define once** in a kernel module, then use from Node, edge, Mastra, or (later) AI SDK.

- One package, **subpath imports**
- Authors write **kernel modules** only
- **Auth is host-owned**: schemas + `withAuth` — nothing is stored here
- Model-facing **descriptions never mention credentials**

## Install

```bash
bun add @harryy/ai-tools
# optional, for Mastra projection:
bun add @mastra/core
```

## Quick start

### Direct call (no AI framework)

```ts
import { runTool } from '@harryy/ai-tools/core'
import { getWeatherTool } from '@harryy/ai-tools/weather'

const weather = await runTool(getWeatherTool, { location: 'London' })
```

### Mastra agent

Mastra’s `createTool` uses:

- **`id`** — stable tool id (docs use kebab-case, e.g. `weather-tool`)
- **object key** on `agent.tools` — this becomes stream `toolName`

So key the record by `id` when you want `toolName === id`.

```ts
import { Agent } from '@mastra/core/agent'
import { createMastraTools } from '@harryy/ai-tools/mastra'
import { weatherModule } from '@harryy/ai-tools/weather'

const tools = createMastraTools(weatherModule)
// => { 'weather-get': MastraTool }

const agent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: 'Answer weather questions using tools.',
  model: 'openai/gpt-4o-mini',
  tools
})
```

Single tool:

```ts
import { createMastraTool } from '@harryy/ai-tools/mastra'
import { getWeatherTool } from '@harryy/ai-tools/weather'

const tools = {
  [getWeatherTool.id]: createMastraTool(getWeatherTool)
}
```

### Auth modules

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { createMastraTools } from '@harryy/ai-tools/mastra'
// import { someModule } from '@harryy/ai-tools/some-module'

const bound = withAuth(someModule, { apiKey: process.env.API_KEY! })
const tools = createMastraTools(bound)
```

- Auth fields are **not** in the model input schema
- Tool `description` tells the model **what/when/bounds**, never how to get API keys

## Package layout

| Subpath | Purpose |
| --- | --- |
| `@harryy/ai-tools/core` | `defineTool`, `defineModule`, `withAuth`, `runTool`, errors |
| `@harryy/ai-tools/http` | `defineHttpApi` fixed-origin HTTP factory |
| `@harryy/ai-tools/weather` | Sample no-auth module |
| `@harryy/ai-tools/mastra` | `createMastraTool`, `createMastraTools` |

## Author a tool

```ts
import { z } from 'zod'
import { defineModule, defineTool } from '@harryy/ai-tools/core'

export const exampleModule = defineModule({
  id: 'example',
  title: 'Example',
  description: 'Example tools.',
  auth: { type: 'none' },
  tools: [
    defineTool({
      id: 'example-ping', // kebab-case; good Mastra id
      name: 'ping',
      description: 'Return pong. Use as a connectivity check.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true) }),
      execute: async () => ({ ok: true as const })
    })
  ]
})
```

HTTP factory:

```ts
import { z } from 'zod'
import { defineHttpApi } from '@harryy/ai-tools/http'

export const demoApi = defineHttpApi({
  id: 'demo',
  title: 'Demo',
  description: 'Demo HTTP API.',
  baseUrl: 'https://api.example.com',
  actions: [
    {
      id: 'demo-list',
      name: 'listItems',
      description: 'List items.',
      method: 'GET',
      path: '/items',
      inputSchema: z.object({}),
      outputSchema: z.object({ items: z.array(z.unknown()) }),
      mapResponse: (data) => ({ items: (data as { items: unknown[] }).items })
    }
  ]
})
```

## Tooling

| Tool | Role |
| --- | --- |
| **oxfmt** | formatter |
| **oxlint** + **oxlint-tsgolint** | type-aware lint (typescript-go) |
| **TypeScript 7** | `tsc --noEmit` |
| **lefthook** | pre-commit staged checks; pre-push `bun run check` |
| **Bun** | install, test, scripts |

```bash
bun install
bun run hooks:install   # once per clone
```

### After every slice

```bash
oxfmt --write <touched-paths>
bun run check           # format:check + type-aware lint + tests
# if exports/build surface changed:
bun run build && bun run typecheck
```

| Command | Proves |
| --- | --- |
| `bun run check` | full gate (same as pre-push) |
| `bun run lint` | oxlint type-aware on `src` + `test` |
| `bun run format:check` | oxfmt clean |
| `bun run test` | unit tests |
| `bun run build` | tsdown ESM + d.ts |
| `bun run typecheck` | tsc |

See `AGENTS.md` for authoring rules.

## Status

Early spine: core + http factory + Mastra adapter + weather sample + tooling gate.  
Build-time module codegen, AI SDK adapter, node/edge export graphs, and more tools come next.
