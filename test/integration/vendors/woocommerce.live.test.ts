/**
 * WooCommerce live IT — read-only only (no create/update/delete/refund/note writes).
 */
import { describe, expect, test } from 'bun:test'

import { WoocommerceClient } from '../../../src/vendors/woocommerce'
import { env } from '../env'

const storeUrl = env('AI_TOOLS_WOO_STORE_URL')
const key = env('AI_TOOLS_WOO_CONSUMER_KEY')
const secret = env('AI_TOOLS_WOO_CONSUMER_SECRET')
const run = storeUrl && key && secret ? describe : describe.skip

function client() {
	return new WoocommerceClient({
		store_url: storeUrl!,
		consumer_key: key!,
		consumer_secret: secret!
	})
}

run('live vendor woocommerce (read-only)', () => {
	test(
		'list + optional get for orders, products, customers, coupons, categories',
		async () => {
			const c = client()

			const orders = await c.listOrders({ limit: 1 })
			expect(Array.isArray(orders.items)).toBe(true)
			const order = orders.items[0]
			if (order) {
				const got = await c.getOrder({ order_id: order.id })
				expect(got.order.id).toBe(order.id)
				const notes = await c.listOrderNotes({ order_id: order.id, limit: 1 })
				expect(Array.isArray(notes.items)).toBe(true)
				const refunds = await c.listOrderRefunds({ order_id: order.id, limit: 1 })
				expect(Array.isArray(refunds.items)).toBe(true)
			}

			const products = await c.listProducts({ limit: 1 })
			expect(Array.isArray(products.items)).toBe(true)
			const product = products.items[0]
			if (product) {
				const got = await c.getProduct({ product_id: product.id })
				expect(got.product.id).toBe(product.id)
				const variations = await c.listProductVariations({ product_id: product.id, limit: 1 })
				expect(Array.isArray(variations.items)).toBe(true)
				const variation = variations.items[0]
				if (variation) {
					const v = await c.getProductVariation({
						product_id: product.id,
						variation_id: variation.id
					})
					expect(v.variation.id).toBe(variation.id)
				}
			}

			const customers = await c.listCustomers({ limit: 1 })
			expect(Array.isArray(customers.items)).toBe(true)
			const customer = customers.items[0]
			if (customer) {
				const got = await c.getCustomer({ customer_id: customer.id })
				expect(got.customer.id).toBe(customer.id)
			}

			const coupons = await c.listCoupons({ limit: 1 })
			expect(Array.isArray(coupons.items)).toBe(true)
			const coupon = coupons.items[0]
			if (coupon) {
				const got = await c.getCoupon({ coupon_id: coupon.id })
				expect(got.coupon.id).toBe(coupon.id)
			}

			const categories = await c.listProductCategories({ limit: 1 })
			expect(Array.isArray(categories.items)).toBe(true)
			const category = categories.items[0]
			if (category) {
				const got = await c.getProductCategory({ category_id: category.id })
				expect(got.category.id).toBe(category.id)
			}
		},
		{ timeout: 60_000 }
	)
})
