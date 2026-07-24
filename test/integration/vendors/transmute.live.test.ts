import { describe, expect, test } from 'bun:test'

import { TransmuteClient } from '../../../src/vendors/transmute'
import { S3Client } from '../../../src/vendors/s3'
import { env, objectKey, s3AuthFromEnv } from '../helpers'

const baseUrl = env('AI_TOOLS_TRANSMUTE_BASE_URL')
const token = env('AI_TOOLS_TRANSMUTE_TOKEN')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const run = baseUrl && token && storage ? describe : describe.skip

run('live vendor transmute', () => {
	test('convert markdown-ish text artifact', async () => {
		const s3 = new S3Client(storage!)
		const sourceKey = objectKey('transmute-src')
		await s3.put({
			key: sourceKey,
			body: '# Hello\n\nTransmute integration.',
			body_encoding: 'utf8',
			content_type: 'text/markdown'
		})

		const client = new TransmuteClient({
			transmute_base_url: baseUrl!,
			transmute_token: token!,
			storage: storage!
		})

		const out = await client.convert({
			source: { store: 'object', key: sourceKey, media_type: 'text/markdown' },
			output_format: 'pdf'
		})
		expect(out.result.key).toBeTruthy()
		await s3.delete({ key: sourceKey }).catch(() => undefined)
	})

	test('convertBatch two sources', async () => {
		const s3 = new S3Client(storage!)
		const keyA = objectKey('transmute-a')
		const keyB = objectKey('transmute-b')
		await s3.put({
			key: keyA,
			body: '# A',
			body_encoding: 'utf8',
			content_type: 'text/markdown'
		})
		await s3.put({
			key: keyB,
			body: '# B',
			body_encoding: 'utf8',
			content_type: 'text/markdown'
		})
		const client = new TransmuteClient({
			transmute_base_url: baseUrl!,
			transmute_token: token!,
			storage: storage!
		})
		const out = await client.convertBatch({
			items: [
				{
					source: { store: 'object', key: keyA, media_type: 'text/markdown' },
					output_format: 'pdf'
				},
				{
					source: { store: 'object', key: keyB, media_type: 'text/markdown' },
					output_format: 'pdf'
				}
			]
		})
		expect(out.results.length).toBe(2)
		await s3.delete({ key: keyA }).catch(() => undefined)
		await s3.delete({ key: keyB }).catch(() => undefined)
	})
})
