import { describe, expect, test } from 'bun:test'

import { createMastraTool, createMastraTools } from '../src/mastra'
import { getWeatherTool, weatherModule } from '../src/modules/weather'

describe('createMastraTool', () => {
	test('projects id and description for the model', () => {
		const mastraTool = createMastraTool(getWeatherTool)
		expect(mastraTool.id).toBe('weather-get')
		expect(mastraTool.description).toBe(getWeatherTool.description)
	})

	test('createMastraTools keys the record by tool id', () => {
		const tools = createMastraTools(weatherModule)
		expect(Object.keys(tools)).toEqual(['weather-get'])
		expect(tools['weather-get']?.id).toBe('weather-get')
	})

	test('execute uses kernel run path', async () => {
		const mastraTool = createMastraTool(getWeatherTool)
		const fetchMock = async () =>
			new Response(
				JSON.stringify({
					current_condition: [{ temp_C: '10', weatherDesc: [{ value: 'Cloudy' }] }],
					nearest_area: [{ areaName: [{ value: 'Paris' }] }]
				}),
				{ status: 200 }
			)

		const original = globalThis.fetch
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
		try {
			const execute = mastraTool.execute
			expect(execute).toBeDefined()
			if (!execute) throw new Error('expected execute')
			// Mastra ToolExecutionContext requires observe at type level; runtime accepts partial context.
			const result = await execute({ location: 'Paris' }, {
				observe: {
					span: async (_n: string, fn: () => unknown) => fn(),
					log: () => undefined
				}
			} as never)
			expect(result).toEqual({
				location: 'Paris',
				temperatureCelsius: 10,
				conditions: 'Cloudy'
			})
		} finally {
			globalThis.fetch = original
		}
	})
})
