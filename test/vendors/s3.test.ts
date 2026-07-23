import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { S3Client, s3Module } from '../../src/vendors/s3'
import { firstXmlText, parseListResult } from '../../src/vendors/s3/domain'

const auth = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	bucket: 'demo'
} as const

describe('s3', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(s3Module).ok).toBe(true)
		expect(s3Module.auth.type).toBe('custom')
		expect(s3Module.tools.map((t) => t.id).sort()).toEqual([
			's3-abort-multipart-upload',
			's3-complete-multipart-upload',
			's3-copy-object',
			's3-create-multipart-upload',
			's3-create-signed-url',
			's3-delete-object',
			's3-get-object',
			's3-head-object',
			's3-list-objects',
			's3-put-object',
			's3-upload-part'
		])
	})

	test('invalid auth rejected at construct', () => {
		expect(() => new S3Client({ ...auth, access_key_id: '' })).toThrow()
	})

	test('parseListResult maps Contents and CommonPrefixes', () => {
		const listed = parseListResult(`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>tok-2</NextContinuationToken>
  <Contents>
    <Key>a/file.pdf</Key>
    <Size>12</Size>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>&quot;abc&quot;</ETag>
  </Contents>
  <Contents>
    <Key>b.txt</Key>
    <Size>0</Size>
  </Contents>
  <CommonPrefixes>
    <Prefix>folder/</Prefix>
  </CommonPrefixes>
</ListBucketResult>`)
		expect(listed.truncated).toBe(true)
		expect(listed.next_cursor).toBe('tok-2')
		expect(listed.common_prefixes).toEqual(['folder/'])
		expect(listed.items).toEqual([
			{
				key: 'a/file.pdf',
				size: 12,
				last_modified: '2024-01-01T00:00:00.000Z',
				etag: 'abc'
			},
			{ key: 'b.txt', size: 0 }
		])
		expect(
			firstXmlText(
				'<InitiateMultipartUploadResult><UploadId>uid-1</UploadId></InitiateMultipartUploadResult>',
				'UploadId'
			)
		).toBe('uid-1')
	})
})
