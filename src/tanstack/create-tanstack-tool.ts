import { toolDefinition } from '@tanstack/ai'

import { resolveTools } from '../core/resolve-tools'
import type { BoundModule, KernelTool, ModuleDefinition, ToolDefinition } from '../core/types'
import { runTool } from '../core/with-auth'

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
		if (signal === undefined) {
			return runTool(kernelTool, args)
		}
		return runTool(kernelTool, args, { signal })
	})
}

/** Project tools into a TanStack AI tool array (chat `tools` accepts arrays). */
export function createTanStackTools(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): TanStackServerTool[] {
	const tools = resolveTools(source)
	const seen = new Set<string>()
	const result: TanStackServerTool[] = []

	for (const kernelTool of tools) {
		if (seen.has(kernelTool.id)) {
			throw new Error(`Duplicate tool id when building TanStack tools: ${kernelTool.id}`)
		}
		seen.add(kernelTool.id)
		result.push(createTanStackTool(kernelTool))
	}

	return result
}

/** Same tools as a record keyed by id for hosts that prefer maps. */
export function createTanStackToolRecord(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): Record<string, TanStackServerTool> {
	const list = createTanStackTools(source)
	const record: Record<string, TanStackServerTool> = {}
	for (const t of list) {
		record[t.name] = t
	}
	return record
}
