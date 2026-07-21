import { createTool } from '@mastra/core/tools'

import { resolveTools } from '../../core/resolve-tools'
import type { BoundModule, KernelTool, ModuleDefinition, ToolDefinition } from '../../core/types'
import { runTool } from '../../core/with-auth'

type MastraTool = ReturnType<typeof createTool>

/**
 * Project one kernel tool into a Mastra tool.
 *
 * Stream `toolName` comes from the object key on `agent.tools`, not from `id`.
 * `createMastraTools` keys by `id` so toolName matches id by default.
 */
export function createMastraTool(tool: ToolDefinition): MastraTool {
	return createTool({
		id: tool.id,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: tool.outputSchema,
		execute: async (input, context) => {
			if (context?.abortSignal === undefined) {
				return runTool(tool, input)
			}
			return runTool(tool, input, { signal: context.abortSignal })
		}
	})
}

/** Project tools into a Mastra tools record keyed by tool id. */
export function createMastraTools(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): Record<string, MastraTool> {
	const tools = resolveTools(source)
	const record: Record<string, MastraTool> = {}

	for (const tool of tools) {
		if (record[tool.id]) {
			throw new Error(`Duplicate tool id when building Mastra tools: ${tool.id}`)
		}
		record[tool.id] = createMastraTool(tool)
	}

	return record
}
