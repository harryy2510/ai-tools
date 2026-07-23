import { toolDefinition } from '@tanstack/ai'
import { keyBy } from 'es-toolkit'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type TanStackServerTool = ReturnType<ReturnType<typeof toolDefinition>['server']>

/**
 * Project one kernel tool into a TanStack AI server tool.
 * Uses tool id as the model-facing name (stable kebab-case).
 */
export function createTanStackTool(kernelTool: ToolDefinition): TanStackServerTool {
	const definition = toolDefinition({
		name: kernelTool.id,
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		outputSchema: kernelTool.outputSchema
	})

	return definition.server(async (args, context) => {
		const signal = context?.abortSignal
		if (!signal) {
			return runTool(kernelTool, args)
		}
		return runTool(kernelTool, args, { signal })
	})
}

/** Project tools into a TanStack AI tool array (chat `tools` accepts arrays). */
export function createTanStackTools(source: ToolSource): TanStackServerTool[] {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building TanStack tools: ${id}`
	)
	return tools.map(createTanStackTool)
}

/** Same tools as a record keyed by id for hosts that prefer maps. */
export function createTanStackToolRecord(source: ToolSource): Record<string, TanStackServerTool> {
	return keyBy(createTanStackTools(source), (t) => t.name)
}
