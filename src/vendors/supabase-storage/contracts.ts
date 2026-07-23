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

export const supabaseStorageAuthSchema = z.object({
	url: z.url().describe('Supabase project URL, for example https://xyz.supabase.co'),
	service_role_key: z.string().min(1).describe('Supabase service role key (host-only)'),
	bucket: z.string().min(1).describe('Storage bucket id')
})

export type SupabaseStorageAuth = z.infer<typeof supabaseStorageAuthSchema>
