import { describe, expect, test } from 'bun:test'
import { isPlainObject, isString } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	copyObjectTool,
	createSignedUrlTool,
	listObjectsTool,
	putObjectTool,
	s3StorageModule
} from '../../src/modules/s3-storage'
import { bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.href
	return input.url
}

function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
	if (input instanceof Request) return input
	return new Request(input, init)
}

function bindS3() {
	return withAuth(s3StorageModule, {
		accessKeyId: 'AKIAtest',
		secretAccessKey: 'secret',
		region: 'auto',
		bucket: 'my-bucket',
		endpoint: 'https://example.r2.cloudflarestorage.com'
	})
}

function findTool(id: string) {
	const bound = bindS3()
	const tool = bound.tools.find((t) => t.id === id)
	if (!tool) throw new Error(`expected tool ${id}`)
	return tool
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object result')
	return value
}

describe('s3-storage', () => {
	test('passes contracts', () => {
		expect(validateModule(s3StorageModule).ok).toBe(true)
		expect(s3StorageModule.tools.map((t) => t.id).sort()).toEqual(
			[
				's3-copy-object',
				's3-create-signed-url',
				's3-delete-object',
				's3-get-object',
				's3-head-object',
				's3-list-objects',
				's3-put-object'
			].sort()
		)
	})

	test('listObjects parses ListObjectsV2 Contents blocks', async () => {
		const tool = findTool(listObjectsTool.id)
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = requestUrl(input)
			expect(url).toContain('my-bucket')
			expect(url).toContain('list-type=2')
			return new Response(
				`<?xml version="1.0"?>
				<ListBucketResult>
					<Contents>
						<Key>a.txt</Key>
						<LastModified>2024-01-02T03:04:05.000Z</LastModified>
						<ETag>&quot;abc&quot;</ETag>
						<Size>12</Size>
					</Contents>
					<Contents>
						<Key>docs/b.txt</Key>
						<Size>3</Size>
					</Contents>
					<CommonPrefixes>
						<Prefix>docs/</Prefix>
					</CommonPrefixes>
					<IsTruncated>false</IsTruncated>
				</ListBucketResult>`,
				{ status: 200 }
			)
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(await runTool(tool, { prefix: 'docs/', delimiter: '/' }))
			expect(result['keys']).toEqual(['a.txt', 'docs/b.txt'])
			expect(result['objects']).toEqual([
				{
					key: 'a.txt',
					size: 12,
					last_modified: '2024-01-02T03:04:05.000Z',
					etag: 'abc'
				},
				{ key: 'docs/b.txt', size: 3 }
			])
			expect(result['common_prefixes']).toEqual(['docs/'])
			expect(result['is_truncated']).toBe(false)
		} finally {
			globalThis.fetch = original
		}
	})

	test('putObject rejects bodies over 5 MiB', async () => {
		const tool = findTool(putObjectTool.id)
		const huge = 'x'.repeat(5 * 1024 * 1024 + 1)
		try {
			await runTool(tool, { key: 'big.txt', body: huge })
			throw new Error('expected too_large')
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('too_large')
		}
	})

	test('copyObject sends x-amz-copy-source', async () => {
		const tool = findTool(copyObjectTool.id)
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = asRequest(input, init)
			expect(req.url).toContain('dest.txt')
			expect(req.method).toBe('PUT')
			expect(req.headers.get('x-amz-copy-source')).toBe('/my-bucket/src.txt')
			return new Response(`<CopyObjectResult><ETag>"etag1"</ETag></CopyObjectResult>`, {
				status: 200
			})
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source_key: 'src.txt',
					destination_key: 'dest.txt'
				})
			)
			expect(result).toEqual({
				source_key: 'src.txt',
				destination_key: 'dest.txt',
				etag: 'etag1'
			})
		} finally {
			globalThis.fetch = original
		}
	})

	test('createSignedUrl returns query-signed URL', async () => {
		const tool = findTool(createSignedUrlTool.id)
		const result = asRecord(
			await runTool(tool, {
				key: 'path/file.txt',
				method: 'GET',
				expires_in: 120
			})
		)
		expect(result['method']).toBe('GET')
		expect(result['expires_in']).toBe(120)
		const url = result['url']
		expect(isString(url)).toBe(true)
		if (!isString(url)) throw new Error('expected url')
		expect(url).toContain('X-Amz-Algorithm=')
		expect(url).toContain('X-Amz-Signature=')
		expect(url).toContain('file.txt')
	})

	test('putObject accepts base64 under the limit', async () => {
		const tool = findTool(putObjectTool.id)
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = asRequest(input, init)
			expect(req.method).toBe('PUT')
			expect(req.headers.get('content-type')).toBe('text/plain')
			return new Response(null, { status: 200, headers: { etag: '"xyz"' } })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					key: 'hi.txt',
					body: bytesToBase64(utf8ToBytes('hi')),
					body_encoding: 'base64',
					content_type: 'text/plain'
				})
			)
			expect(result).toEqual({ key: 'hi.txt', etag: 'xyz', content_length: 2 })
		} finally {
			globalThis.fetch = original
		}
	})
})
