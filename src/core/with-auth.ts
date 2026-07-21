import { ToolError } from './errors'
import type {
	AuthDefinition,
	BoundModule,
	BoundToolDefinition,
	ModuleDefinition,
	ToolContext,
	ToolDefinition
} from './types'

function assertAuth<TAuth>(auth: AuthDefinition<TAuth>, value: unknown): TAuth | undefined {
	if (auth.type === 'none') {
		if (value !== undefined) {
			throw new ToolError('This tool does not accept auth', { code: 'bad_auth' })
		}
		return undefined
	}

	const parsed = auth.schema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Invalid auth credentials', {
			code: 'bad_auth',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}

	return parsed.data
}

function buildBoundContext(ctx: Omit<ToolContext, 'auth'>, auth: unknown): ToolContext {
	if (auth === undefined) {
		return { ...ctx }
	}
	return { ...ctx, auth }
}

export function withAuthTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	auth: unknown
): BoundToolDefinition {
	return {
		id: tool.id,
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: tool.outputSchema,
		meta: tool.meta,
		execute: async (input, ctx) => tool.execute(input, buildBoundContext(ctx, auth))
	}
}

/**
 * Bind validated credentials into a module's tools.
 * Model-facing schemas never include auth; hosts call this before agent projection.
 */
export function withAuth<TAuth>(module: ModuleDefinition<TAuth>, auth?: TAuth): BoundModule<TAuth> {
	if (module.auth.type !== 'none' && auth === undefined) {
		throw new ToolError(`Module ${module.id} requires auth`, { code: 'bad_auth' })
	}

	const boundAuth = assertAuth(module.auth, auth)

	const tools: BoundToolDefinition[] = module.tools.map((tool) => ({
		id: tool.id,
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: tool.outputSchema,
		meta: tool.meta,
		execute: async (input, ctx) => tool.execute(input, buildBoundContext(ctx, boundAuth))
	}))

	return {
		id: module.id,
		title: module.title,
		description: module.description,
		runtime: module.runtime,
		auth: module.auth,
		tools
	}
}

type RunnableTool<TInput, TOutput> = {
	inputSchema: {
		safeParse: (
			value: unknown
		) => { success: true; data: TInput } | { success: false; error: { issues: ReadonlyArray<{ message: string }> } }
	}
	outputSchema: {
		safeParse: (
			value: unknown
		) => { success: true; data: TOutput } | { success: false; error: { issues: ReadonlyArray<{ message: string }> } }
	}
	execute: (input: unknown, ctx: ToolContext) => Promise<unknown>
}

/** Run a tool after validating input (and using already-bound auth when present). */
export async function runTool<TInput, TOutput>(
	tool: RunnableTool<TInput, TOutput>,
	input: TInput,
	ctx: ToolContext = {}
): Promise<TOutput> {
	const parsedInput = tool.inputSchema.safeParse(input)
	if (!parsedInput.success) {
		throw new ToolError('Invalid tool input', {
			code: 'bad_input',
			details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
		})
	}

	const output = await tool.execute(parsedInput.data, ctx)
	const parsedOutput = tool.outputSchema.safeParse(output)
	if (!parsedOutput.success) {
		throw new ToolError('Tool returned invalid output', {
			code: 'internal',
			details: { issues: parsedOutput.error.issues.map((issue) => issue.message) }
		})
	}

	return parsedOutput.data
}

export function listTools(module: ModuleDefinition | BoundModule): readonly ToolDefinition[] {
	return module.tools.map((tool) => ({
		id: tool.id,
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: tool.outputSchema,
		meta: tool.meta,
		execute: async (input, ctx) => tool.execute(input, ctx)
	}))
}
