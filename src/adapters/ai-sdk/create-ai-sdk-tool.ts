import { dynamicTool } from 'ai'
import { keyBy, mapValues } from 'es-toolkit'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type AiSdkTool = ReturnType<typeof dynamicTool>

/**
 * Project one kernel tool into a Vercel AI SDK dynamic tool.
 * Kernel tools are schema-erased at the boundary; dynamicTool matches that shape.
 */
export function createAiSdkTool(kernelTool: ToolDefinition): AiSdkTool {
	return dynamicTool({
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		execute: async (input, options) => {
			if (options.abortSignal === undefined) {
				return runTool(kernelTool, input)
			}
			return runTool(kernelTool, input, { signal: options.abortSignal })
		}
	})
}

/** Project tools into an AI SDK tools record keyed by tool id. */
export function createAiSdkTools(source: ToolSource): Record<string, AiSdkTool> {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building AI SDK tools: ${id}`
	)
	return mapValues(
		keyBy(tools, (t) => t.id),
		createAiSdkTool
	)
}
