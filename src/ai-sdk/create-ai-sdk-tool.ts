import { dynamicTool } from 'ai'

import { resolveTools } from '../core/resolve-tools'
import type { BoundModule, KernelTool, ModuleDefinition, ToolDefinition } from '../core/types'
import { runTool } from '../core/with-auth'

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
export function createAiSdkTools(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): Record<string, AiSdkTool> {
	const tools = resolveTools(source)
	const record: Record<string, AiSdkTool> = {}

	for (const kernelTool of tools) {
		if (record[kernelTool.id]) {
			throw new Error(`Duplicate tool id when building AI SDK tools: ${kernelTool.id}`)
		}
		record[kernelTool.id] = createAiSdkTool(kernelTool)
	}

	return record
}
