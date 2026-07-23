import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { AmazonSpApiClient, amazonSpApiModule } from '../../src/vendors/amazon-sp-api'

function mockFetch(handler: (url: string, headers: Headers, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		const headers = input instanceof Request ? new Headers(input.headers) : new Headers(init?.headers)
		return handler(url, headers, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

function inputIsPost(init?: RequestInit): boolean {
	return (init?.method ?? 'GET').toUpperCase() === 'POST'
}

const auth = {
	client_id: 'amzn1.application-oa2-client.x',
	client_secret: 'secret',
	refresh_token: 'Atzr|refresh',
	access_key_id: 'AKIA',
	secret_access_key: 'secretkey',
	region: 'us-east-1',
	endpoint: 'https://sellingpartnerapi-na.amazon.com' as const,
	marketplace_ids: ['ATVPDKIKX0DER']
}

describe('amazon-sp-api', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(amazonSpApiModule).ok).toBe(true)
		expect(amazonSpApiModule.tools.map((t) => t.id).sort()).toEqual([
			'amazon-sp-api-get-order',
			'amazon-sp-api-list-inventory-summaries',
			'amazon-sp-api-list-orders'
		])
	})

	test('listOrders exchanges LWA token then calls Orders API', async () => {
		let lwaCalls = 0
		const restore = mockFetch((url, headers, init) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				lwaCalls += 1
				expect(inputIsPost(init)).toBe(true)
				return new Response(JSON.stringify({ access_token: 'Atza|access', expires_in: 3600 }), {
					status: 200
				})
			}
			expect(url).toContain('sellingpartnerapi-na.amazon.com/orders/v0/orders')
			expect(url).toContain('MarketplaceIds=ATVPDKIKX0DER')
			// ofetch may pass a signed Request; token is on Request headers after LWA
			expect(headers.get('x-amz-access-token') ?? headers.get('X-Amz-Access-Token')).toBe('Atza|access')
			return new Response(
				JSON.stringify({
					payload: {
						Orders: [
							{
								AmazonOrderId: '111-222',
								OrderStatus: 'Shipped',
								PurchaseDate: '2026-01-01T00:00:00Z',
								OrderTotal: { Amount: '10.00', CurrencyCode: 'USD' }
							}
						]
					}
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const result = await client.listOrders({ created_after: '2026-01-01T00:00:00Z' })
			expect(lwaCalls).toBe(1)
			expect(result.items[0]?.amazon_order_id).toBe('111-222')
			expect(result.items[0]?.order_total_amount).toBe('10.00')
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})
})
