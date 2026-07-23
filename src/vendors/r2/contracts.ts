import { z } from 'zod'

import {
	copyObjectInputSchema,
	copyObjectOutputSchema,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	MAX_OBJECT_BYTES,
	putObjectInputSchema,
	putObjectOutputSchema
} from '../_storage'

export {
	copyObjectInputSchema,
	copyObjectOutputSchema,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	MAX_OBJECT_BYTES,
	putObjectInputSchema,
	putObjectOutputSchema
}
export type {
	CopyObjectInput,
	CopyObjectOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput
} from '../_storage'

/**
 * Cloudflare R2 via the **Cloudflare REST API** (api.cloudflare.com).
 * For S3-compatible R2 endpoint, use the S3 vendor + endpoint instead.
 *
 * @see https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/
 */
export const r2AuthSchema = z.object({
	account_id: z.string().min(1).describe('Cloudflare account id'),
	api_token: z.string().min(1).describe('Cloudflare API token with R2 object permissions'),
	bucket: z.string().min(1).describe('R2 bucket name'),
	jurisdiction: z.enum(['default', 'eu', 'fedramp']).optional().describe('Optional cf-r2-jurisdiction header')
})

export type R2Auth = z.infer<typeof r2AuthSchema>
