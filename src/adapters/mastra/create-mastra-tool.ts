import { createTool } from '@mastra/core/tools'
import { keyBy, mapValues } from 'es-toolkit'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
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
			if (!context?.abortSignal) {
				return runTool(tool, input)
			}
			return runTool(tool, input, { signal: context.abortSignal })
		}
	})
}

/** Project tools into a Mastra tools record keyed by tool id. */
export function createMastraTools(source: ToolSource): Record<string, MastraTool> {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building Mastra tools: ${id}`
	)
	return mapValues(
		keyBy(tools, (t) => t.id),
		createMastraTool
	)
}
