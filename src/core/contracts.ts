import { zodToJsonSchema } from './json-schema'
import type { ModuleDefinition, ToolDefinition } from './types'

const FORBIDDEN_MODEL_COPY =
	/\b(api[_ ]?key|apiKey|bearer token|process\.env|vault|secret key|authorization header|withAuth)\b/i

const KEBAB_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export type ContractIssue = {
	code:
		| 'duplicate_tool_id'
		| 'empty_description'
		| 'empty_field_description'
		| 'forbidden_model_copy'
		| 'invalid_tool_id'
		| 'missing_name'
	message: string
	path: string
}

export type ContractResult = {
	ok: boolean
	issues: ContractIssue[]
}

function issue(path: string, code: ContractIssue['code'], message: string): ContractIssue {
	return { path, code, message }
}

function checkModelCopy(path: string, text: string, issues: ContractIssue[]): void {
	const trimmed = text.trim()
	if (!trimmed) {
		issues.push(issue(path, 'empty_description', 'Model-facing description is empty'))
		return
	}
	if (FORBIDDEN_MODEL_COPY.test(trimmed)) {
		issues.push(
			issue(
				path,
				'forbidden_model_copy',
				'Model-facing copy must not mention credentials, env vars, vaults, or host wiring'
			)
		)
	}
}

function fieldDescribes(schema: ToolDefinition['inputSchema'], path: string, issues: ContractIssue[]): void {
	const json = zodToJsonSchema(schema)
	const properties = json['properties']
	if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
		return
	}
	for (const [key, value] of Object.entries(properties)) {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
		const description = value['description']
		if (typeof description !== 'string' || description.trim().length === 0) {
			issues.push(
				issue(
					`${path}.input.${key}`,
					'empty_field_description',
					`Input field "${key}" is missing a .describe() for the model`
				)
			)
			continue
		}
		checkModelCopy(`${path}.input.${key}`, description, issues)
	}
}

export function validateTool(tool: ToolDefinition, pathPrefix = tool.id): ContractResult {
	const issues: ContractIssue[] = []

	if (!tool.id.trim() || !KEBAB_ID.test(tool.id)) {
		issues.push(issue(`${pathPrefix}.id`, 'invalid_tool_id', `Tool id must be kebab-case (got "${tool.id}")`))
	}
	if (!tool.name.trim()) {
		issues.push(issue(`${pathPrefix}.name`, 'missing_name', 'Tool name is required'))
	}
	checkModelCopy(`${pathPrefix}.description`, tool.description, issues)
	fieldDescribes(tool.inputSchema, pathPrefix, issues)

	return { ok: issues.length === 0, issues }
}

export function validateModule(module: ModuleDefinition): ContractResult {
	const issues: ContractIssue[] = []
	checkModelCopy(`module.${module.id}.description`, module.description, issues)

	const seen = new Set<string>()
	for (const tool of module.tools) {
		if (seen.has(tool.id)) {
			issues.push(issue(`module.${module.id}.tools.${tool.id}`, 'duplicate_tool_id', `Duplicate tool id "${tool.id}"`))
		}
		seen.add(tool.id)
		const result = validateTool(tool, `module.${module.id}.tools.${tool.id}`)
		issues.push(...result.issues)
	}

	return { ok: issues.length === 0, issues }
}

export function assertContracts(result: ContractResult, label = 'contract'): void {
	if (result.ok) return
	const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')
	throw new Error(`${label} failed:\n${detail}`)
}
