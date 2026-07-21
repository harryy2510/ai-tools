import { describe, expect, test } from 'bun:test'

import { runTool } from '../src/core'
import { getWeatherTool, weatherModule } from '../src/modules/weather'

describe('weather module', () => {
	test('has no auth and stable ids', () => {
		expect(weatherModule.auth.type).toBe('none')
		expect(getWeatherTool.id).toBe('weather-get')
		expect(getWeatherTool.description.length).toBeGreaterThan(20)
	})

	test('getWeather maps provider payload', async () => {
		const fetchMock = async () =>
			new Response(
				JSON.stringify({
					current_condition: [{ temp_C: '21', weatherDesc: [{ value: 'Sunny' }] }],
					nearest_area: [{ areaName: [{ value: 'London' }] }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)

		const result = await runTool(getWeatherTool, { location: 'London' }, { fetch: fetchMock })

		expect(result).toEqual({
			location: 'London',
			temperatureCelsius: 21,
			conditions: 'Sunny'
		})
	})
})
