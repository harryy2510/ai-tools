# `@harryy/ai-tools/mastra`

Project kernel tools to [Mastra](https://mastra.ai) tool objects.

## Peer

```bash
bun add @mastra/core   # >= 1.0
```

## API

```ts
import { createMastraTool, createMastraTools } from '@harryy/ai-tools/mastra'

createMastraTool(tool)           // one tool
createMastraTools(moduleOrTools) // record / list for agent registration
```

- Tool **id** is the stable Mastra tool name.
- Input/output schemas come from the kernel Zod schemas.
- Bind auth with `withAuth` before projecting modules that require credentials.

## Example

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { s3StorageModule } from '@harryy/ai-tools/s3-storage'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const tools = createMastraTools(
  withAuth(s3StorageModule, {
    accessKeyId: '…',
    secretAccessKey: '…',
    region: 'auto',
    bucket: 'my-bucket',
  }),
)
```

## Notes

- Peer is optional at install time; importing this subpath requires `@mastra/core` present.
- No per-module factories — always project from kernel definitions.

## Related

- [Adapters guide](../guides/adapters.md)
- [core](./core.md)
