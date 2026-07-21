import { isPlainObject } from 'es-toolkit'
import type { z } from 'zod'
import { toJSONSchema } from 'zod'

/** JSON Schema object suitable for OpenAI/Cloudflare-style tool parameters. */
export type JsonSchemaObject = Record<string, unknown>

/**
 * Convert a Zod schema to JSON Schema for hosts/adapters that need parameters objects.
 * Model-facing field descriptions on the Zod schema are preserved by Zod's converter.
 */
export function zodToJsonSchema(schema: z.ZodType): JsonSchemaObject {
	const json = toJSONSchema(schema)
	if (!isPlainObject(json)) {
		return { type: 'object', properties: {} }
	}
	return json
}
