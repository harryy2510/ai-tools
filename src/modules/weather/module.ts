import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolDefinition } from '../../core/types'

const getWeatherInputSchema = z.object({
	location: z.string().min(1).max(120).describe('City or place name, for example London or San Francisco')
})

const getWeatherOutputSchema = z.object({
	conditions: z.string().describe('Short weather condition text'),
	location: z.string().describe('Resolved location label'),
	temperatureCelsius: z.number().describe('Current temperature in Celsius')
})

const wttrResponseSchema = z.object({
	current_condition: z
		.array(
			z.object({
				temp_C: z.string().optional(),
				weatherDesc: z.array(z.object({ value: z.string().optional() })).optional()
			})
		)
		.optional(),
	nearest_area: z
		.array(
			z.object({
				areaName: z.array(z.object({ value: z.string().optional() })).optional()
			})
		)
		.optional()
})

export const getWeatherTool: ToolDefinition<
	z.infer<typeof getWeatherInputSchema>,
	z.infer<typeof getWeatherOutputSchema>
> = defineTool({
	id: 'weather-get',
	name: 'getWeather',
	description:
		'Get the current weather for a city or place. Use when the user asks about temperature or conditions right now. Returns Celsius temperature and a short condition string.',
	inputSchema: getWeatherInputSchema,
	outputSchema: getWeatherOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async ({ location }, ctx) => {
		const fetchImpl = ctx.fetch ?? globalThis.fetch
		if (!fetchImpl) {
			throw new ToolError('fetch is not available', { code: 'unsupported_runtime' })
		}

		const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`
		const init: RequestInit = {
			headers: { Accept: 'application/json', 'User-Agent': '@harryy/ai-tools' }
		}
		if (ctx.signal) {
			init.signal = ctx.signal
		}

		let response: Response
		try {
			response = await fetchImpl(url, init)
		} catch (error) {
			throw new ToolError('Failed to reach weather provider', {
				code: 'upstream',
				retryable: true,
				cause: error
			})
		}

		if (!response.ok) {
			throw new ToolError(`Weather provider returned HTTP ${response.status}`, {
				code: response.status === 404 ? 'not_found' : 'upstream',
				retryable: response.status >= 500
			})
		}

		const raw: unknown = await response.json()
		const parsed = wttrResponseSchema.safeParse(raw)
		if (!parsed.success) {
			throw new ToolError('Weather provider returned an unexpected payload', {
				code: 'upstream'
			})
		}

		const current = parsed.data.current_condition?.[0]
		const area = parsed.data.nearest_area?.[0]?.areaName?.[0]?.value
		const temperature = Number(current?.temp_C)
		const conditions = current?.weatherDesc?.[0]?.value

		if (!Number.isFinite(temperature) || !conditions) {
			throw new ToolError('Weather provider returned an unexpected payload', {
				code: 'upstream'
			})
		}

		return getWeatherOutputSchema.parse({
			location: area ?? location,
			temperatureCelsius: temperature,
			conditions
		})
	}
})

/**
 * Sample no-auth module. Model descriptions cover when/how to call the tool only.
 */
export const weatherModule = defineModule({
	id: 'weather',
	title: 'Weather',
	description: 'Current weather lookup for a location.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [getWeatherTool]
})
