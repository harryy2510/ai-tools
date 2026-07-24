import { describe, expect, test } from 'bun:test'

import { WebFetchClient } from '../../../src/modules/web-fetch'

/** Hits a public origin — always runnable when network is available. */
describe('live seam web-fetch', () => {
	test('GET example.com', async () => {
		const client = new WebFetchClient({
			allowed_origins: ['https://example.com']
		})
		const res = await client.get({ url: 'https://example.com/' })
		expect(res.status).toBeGreaterThanOrEqual(200)
		expect(res.status).toBeLessThan(400)
	})
})
