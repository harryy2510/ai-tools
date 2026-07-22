import type { ToolDefinition, ToolSource } from './types'

export function isToolArray(source: ToolSource): source is readonly ToolDefinition[] {
	return Array.isArray(source)
}

/** Normalize a module or tool list into a flat tool list. */
export function resolveTools(source: ToolSource): readonly ToolDefinition[] {
	return isToolArray(source) ? source : source.tools
}

export function filterToolsByRuntime(tools: readonly ToolDefinition[], runtime: 'edge' | 'node'): ToolDefinition[] {
	return tools.filter((tool) => tool.meta.runtime === 'both' || tool.meta.runtime === runtime)
}
