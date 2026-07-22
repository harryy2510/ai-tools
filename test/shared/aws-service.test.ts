import { describe, expect, test } from 'bun:test'

import { isToolError } from '../../src/core'
import { AwsService } from '../../src/shared/aws-service'

describe('AwsService', () => {
	test('get signs request and parses json', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			expect(req.method).toBe('GET')
			expect(req.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256')).toBe(true)
			expect(req.url).toContain('example.s3.us-east-1.amazonaws.com')
			return new Response(JSON.stringify({ Contents: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const aws = new AwsService({
				accessKeyId: 'AKIATEST',
				secretAccessKey: 'secret',
				region: 'us-east-1',
				service: 's3',
				label: 'S3'
			})
			const result = await aws.get('https://example.s3.us-east-1.amazonaws.com/?list-type=2')
			expect(result.ok).toBe(true)
			expect(result.data).toEqual({ Contents: [] })
		} finally {
			globalThis.fetch = original
		}
	})

	test('put with body', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			expect(req.method).toBe('PUT')
			expect(req.headers.get('authorization')).toBeTruthy()
			return new Response(null, { status: 200, headers: { etag: '"abc"' } })
		}) as typeof globalThis.fetch

		try {
			const aws = new AwsService({
				accessKeyId: 'AKIATEST',
				secretAccessKey: 'secret',
				region: 'us-east-1',
				service: 's3',
				label: 'S3'
			})
			const result = await aws.put('https://example.s3.us-east-1.amazonaws.com/key.txt', 'hello', {
				headers: { 'content-type': 'text/plain' }
			})
			expect(result.status).toBe(200)
		} finally {
			globalThis.fetch = original
		}
	})

	test('throws on 403 by default', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async () => new Response('denied', { status: 403 })) as unknown as typeof globalThis.fetch

		try {
			const aws = new AwsService({
				accessKeyId: 'AKIATEST',
				secretAccessKey: 'secret',
				region: 'us-east-1',
				service: 's3',
				label: 'S3'
			})
			await aws.get('https://example.s3.us-east-1.amazonaws.com/secret')
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('forbidden')
		} finally {
			globalThis.fetch = original
		}
	})

	test('sign returns signed query url', async () => {
		const aws = new AwsService({
			accessKeyId: 'AKIATEST',
			secretAccessKey: 'secret',
			region: 'us-east-1',
			service: 's3',
			label: 'S3'
		})
		const signed = await aws.sign('https://example.s3.us-east-1.amazonaws.com/key?X-Amz-Expires=3600', {
			method: 'GET',
			signQuery: true
		})
		expect(signed.url).toContain('X-Amz-Signature=')
		expect(signed.method).toBe('GET')
	})
})
