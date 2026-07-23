import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { WoocommerceClient, woocommerceModule } from '../../src/vendors/woocommerce'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = {
	store_url: 'https://shop.example.com',
	consumer_key: 'ck_test',
	consumer_secret: 'cs_test'
} as const

describe('woocommerce', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(woocommerceModule).ok).toBe(true)
		expect(woocommerceModule.tools.map((t) => t.id).sort()).toEqual([
			'woocommerce-get-order',
			'woocommerce-get-product',
			'woocommerce-list-orders',
			'woocommerce-list-products'
		])
	})

	test('listOrders posts to wc/v3 with basic auth', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('https://shop.example.com/wp-json/wc/v3/orders')
			expect(url).toContain('per_page=10')
			expect(init?.method).toBe('GET')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')?.startsWith('Basic ')).toBe(true)
			return new Response(
				JSON.stringify([
					{
						id: 12,
						number: '12',
						status: 'processing',
						currency: 'USD',
						total: '19.00',
						date_created: '2026-01-01T00:00:00'
					}
				]),
				{ status: 200, headers: { 'x-wp-totalpages': '1' } }
			)
		})

		try {
			const client = new WoocommerceClient(auth)
			const result = await client.listOrders({})
			expect(result.items).toHaveLength(1)
			expect(result.items[0]?.id).toBe(12)
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('listOrders tool via withAuth', async () => {
		const bound = withAuth(woocommerceModule, auth)
		const tool = bound.tools.find((t) => t.id === 'woocommerce-list-orders')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch(
			() => new Response(JSON.stringify([]), { status: 200, headers: { 'x-wp-totalpages': '1' } })
		)
		try {
			const result = asRecord(await runTool(tool, { limit: 5 }))
			expect(Array.isArray(result['items'])).toBe(true)
			expect(result['truncated']).toBe(false)
		} finally {
			restore()
		}
	})
})
