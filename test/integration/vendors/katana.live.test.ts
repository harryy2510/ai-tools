import { describe, expect, test } from 'bun:test'

import { KatanaClient } from '../../../src/vendors/katana'
import { env } from '../env'

const apiKey = env('AI_TOOLS_KATANA_API_KEY')
const run = apiKey ? describe : describe.skip

run('live vendor katana', () => {
	test('listProducts page', async () => {
		const client = new KatanaClient({ api_key: apiKey! })
		const out = await client.listProducts({ limit: 1 })
		expect(out).toBeDefined()
	})
})
