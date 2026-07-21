import type { BoundModule, KernelTool, ModuleDefinition, ToolDefinition } from './types'

export function isToolArray(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): source is readonly KernelTool[] {
	return Array.isArray(source)
}

/** Normalize a module, bound module, or tool list into a flat tool list. */
export function resolveTools(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): readonly ToolDefinition[] {
	return isToolArray(source) ? source : source.tools
}

export function filterToolsByRuntime(tools: readonly ToolDefinition[], runtime: 'edge' | 'node'): ToolDefinition[] {
	return tools.filter((tool) => {
		if (tool.meta.runtime === 'both') return true
		return tool.meta.runtime === runtime
	})
}
