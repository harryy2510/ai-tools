import { describe, expect, test } from 'bun:test'

import { WoocommerceClient } from '../../../src/vendors/woocommerce'
import { env } from '../env'

const storeUrl = env('AI_TOOLS_WOO_STORE_URL')
const key = env('AI_TOOLS_WOO_CONSUMER_KEY')
const secret = env('AI_TOOLS_WOO_CONSUMER_SECRET')
const run = storeUrl && key && secret ? describe : describe.skip

run('live vendor woocommerce', () => {
	test('listOrders page', async () => {
		const client = new WoocommerceClient({
			store_url: storeUrl!,
			consumer_key: key!,
			consumer_secret: secret!
		})
		const out = await client.listOrders({ limit: 1 })
		expect(Array.isArray(out.items)).toBe(true)
	})
})
