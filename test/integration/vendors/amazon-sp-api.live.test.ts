import { describe, expect, test } from 'bun:test'

import { AmazonSpApiClient } from '../../../src/vendors/amazon-sp-api'
import { env } from '../env'

const clientId = env('AI_TOOLS_AMAZON_CLIENT_ID')
const clientSecret = env('AI_TOOLS_AMAZON_CLIENT_SECRET')
const refreshToken = env('AI_TOOLS_AMAZON_REFRESH_TOKEN')
const accessKeyId = env('AI_TOOLS_AMAZON_ACCESS_KEY_ID')
const secretAccessKey = env('AI_TOOLS_AMAZON_SECRET_ACCESS_KEY')
const region = env('AI_TOOLS_AMAZON_REGION')
const endpoint = env('AI_TOOLS_AMAZON_ENDPOINT')
const marketplaceIds = env('AI_TOOLS_AMAZON_MARKETPLACE_IDS')
const run =
	clientId && clientSecret && refreshToken && accessKeyId && secretAccessKey && region && endpoint && marketplaceIds
		? describe
		: describe.skip

run('live vendor amazon-sp-api', () => {
	test('listOrders', async () => {
		const ep = endpoint!
		if (
			ep !== 'https://sellingpartnerapi-na.amazon.com' &&
			ep !== 'https://sellingpartnerapi-eu.amazon.com' &&
			ep !== 'https://sellingpartnerapi-fe.amazon.com'
		) {
			throw new Error('AI_TOOLS_AMAZON_ENDPOINT must be a sellingpartnerapi-{na,eu,fe}.amazon.com URL')
		}
		const client = new AmazonSpApiClient({
			client_id: clientId!,
			client_secret: clientSecret!,
			refresh_token: refreshToken!,
			access_key_id: accessKeyId!,
			secret_access_key: secretAccessKey!,
			region: region!,
			endpoint: ep,
			marketplace_ids: marketplaceIds!.split(',').map((s) => s.trim())
		})
		const out = await client.listOrders({
			created_after: new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
		})
		expect(out).toBeDefined()
	})
})
