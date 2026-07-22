import { toJSONSchema } from 'zod'

import type { AuthDefinition, ModuleDefinition, ToolDefinition } from './types'

export type ToolCatalogEntry = {
	description: string
	id: string
	inputJsonSchema: Record<string, unknown>
	name: string
	outputJsonSchema: Record<string, unknown>
	runtime: ToolDefinition['meta']['runtime']
	sideEffect: ToolDefinition['meta']['sideEffect']
	tags: readonly string[]
}

export type ModuleCatalogEntry = {
	authType: AuthDefinition<unknown>['type']
	description: string
	id: string
	runtime: ModuleDefinition['runtime']
	title: string
	tools: ToolCatalogEntry[]
}

export function toToolCatalogEntry(tool: ToolDefinition): ToolCatalogEntry {
	return {
		id: tool.id,
		name: tool.name,
		description: tool.description,
		runtime: tool.meta.runtime,
		sideEffect: tool.meta.sideEffect,
		tags: tool.meta.tags ?? [],
		inputJsonSchema: toJSONSchema(tool.inputSchema),
		outputJsonSchema: toJSONSchema(tool.outputSchema)
	}
}

export function toModuleCatalogEntry(module: ModuleDefinition): ModuleCatalogEntry {
	return {
		id: module.id,
		title: module.title,
		description: module.description,
		runtime: module.runtime,
		authType: module.auth.type,
		tools: module.tools.map(toToolCatalogEntry)
	}
}
