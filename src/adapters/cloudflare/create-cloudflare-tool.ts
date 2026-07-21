import { zodToJsonSchema } from '../../core/json-schema'
import { resolveTools } from '../../core/resolve-tools'
import type { BoundModule, KernelTool, ModuleDefinition, ToolContext, ToolDefinition } from '../../core/types'
import { runTool } from '../../core/with-auth'

/**
 * Traditional Workers AI / OpenAI-style tool definition (parameters JSON Schema).
 * @see https://developers.cloudflare.com/workers-ai/features/function-calling/
 */
export type CloudflareAiToolDefinition = {
	description: string
	name: string
	parameters: Record<string, unknown>
}

export type CloudflareAiToolset = {
	/** Pass to `env.AI.run(..., { tools })`. */
	definitions: CloudflareAiToolDefinition[]
	/**
	 * Run a model-selected tool by name with raw arguments.
	 * Host wires this after reading `response.tool_calls`.
	 */
	execute: (name: string, args: unknown, ctx?: ToolContext) => Promise<unknown>
	/** Direct map of name → execute for custom loops. */
	executors: Record<string, (args: unknown, ctx?: ToolContext) => Promise<unknown>>
}

export function createCloudflareAiToolDefinition(tool: ToolDefinition): CloudflareAiToolDefinition {
	return {
		name: tool.id,
		description: tool.description,
		parameters: zodToJsonSchema(tool.inputSchema)
	}
}

/**
 * Project kernel tools into Cloudflare Workers AI traditional function-calling shape
 * plus host-side executors. No Cloudflare package dependency required.
 */
export function createCloudflareAiTools(
	source: ModuleDefinition | BoundModule | readonly KernelTool[]
): CloudflareAiToolset {
	const tools = resolveTools(source)
	const definitions: CloudflareAiToolDefinition[] = []
	const executors: Record<string, (args: unknown, ctx?: ToolContext) => Promise<unknown>> = {}

	for (const tool of tools) {
		if (executors[tool.id]) {
			throw new Error(`Duplicate tool id when building Cloudflare tools: ${tool.id}`)
		}
		definitions.push(createCloudflareAiToolDefinition(tool))
		executors[tool.id] = async (args, ctx = {}) => runTool(tool, args, ctx)
	}

	return {
		definitions,
		executors,
		execute: async (name, args, ctx = {}) => {
			const run = executors[name]
			if (!run) {
				throw new Error(`Unknown Cloudflare tool: ${name}`)
			}
			return run(args, ctx)
		}
	}
}
