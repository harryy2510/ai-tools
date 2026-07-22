import { describe, expect, test } from 'bun:test'

import { ToolError } from '../../src/core/errors'
import { runBatchItems } from '../../src/shared/batch'

describe('runBatchItems', () => {
	test('partial failure', async () => {
		const result = await runBatchItems([1, 2, 3], async (n) => {
			if (n === 2) throw new ToolError('nope', { code: 'upstream' })
			return n * 10
		})
		expect(result.succeeded).toBe(2)
		expect(result.failed).toBe(1)
		expect(result.results[1]?.error?.code).toBe('upstream')
	})

	test('concurrency', async () => {
		let max = 0
		let n = 0
		await runBatchItems(
			[1, 2, 3, 4],
			async () => {
				n += 1
				max = Math.max(max, n)
				await new Promise((r) => setTimeout(r, 15))
				n -= 1
			},
			{ concurrency: 2 }
		)
		expect(max).toBeGreaterThanOrEqual(2)
	})

	test('retries retryable only', async () => {
		let attempts = 0
		const result = await runBatchItems(
			['x'],
			async () => {
				attempts += 1
				if (attempts < 3) throw new ToolError('tmp', { code: 'rate_limited', retryable: true })
				return 'ok'
			},
			{ retries: 5 }
		)
		expect(result.results[0]?.value).toBe('ok')
		expect(attempts).toBe(3)
	})
})
