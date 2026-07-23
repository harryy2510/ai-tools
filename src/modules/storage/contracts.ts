/**
 * Storage seam contracts — shared I/O from vendors/_storage + provider auth union.
 */

import { z } from 'zod'

import {
	abortMultipartUploadInputSchema,
	abortMultipartUploadOutputSchema,
	completeMultipartUploadInputSchema,
	completeMultipartUploadOutputSchema,
	copyObjectInputSchema,
	copyObjectOutputSchema,
	createMultipartUploadInputSchema,
	createMultipartUploadOutputSchema,
	DEFAULT_SIGNED_URL_SECONDS,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	deleteObjectsInputSchema,
	deleteObjectsOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	getObjectsInputSchema,
	getObjectsOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	listedObjectSchema,
	MAX_BATCH_ITEMS,
	MAX_MULTIPART_PART_BYTES,
	MAX_OBJECT_BYTES,
	MAX_SIGNED_URL_SECONDS,
	multipartUploadedPartSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	putObjectsInputSchema,
	putObjectsOutputSchema,
	signedUrlInputSchema,
	signedUrlOutputSchema,
	uploadPartInputSchema,
	uploadPartOutputSchema
} from '../../vendors/_storage'
import type {
	AbortMultipartUploadInput,
	AbortMultipartUploadOutput,
	CompleteMultipartUploadInput,
	CompleteMultipartUploadOutput,
	CopyObjectInput,
	CopyObjectOutput,
	CreateMultipartUploadInput,
	CreateMultipartUploadOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput,
	SignedUrlInput,
	SignedUrlOutput,
	UploadPartInput,
	UploadPartOutput
} from '../../vendors/_storage'
import { r2AuthSchema } from '../../vendors/r2'
import { s3AuthSchema } from '../../vendors/s3'
import { supabaseStorageAuthSchema } from '../../vendors/supabase-storage'

export {
	abortMultipartUploadInputSchema,
	abortMultipartUploadOutputSchema,
	completeMultipartUploadInputSchema,
	completeMultipartUploadOutputSchema,
	copyObjectInputSchema,
	copyObjectOutputSchema,
	createMultipartUploadInputSchema,
	createMultipartUploadOutputSchema,
	DEFAULT_SIGNED_URL_SECONDS,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	deleteObjectsInputSchema,
	deleteObjectsOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	getObjectsInputSchema,
	getObjectsOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	listedObjectSchema,
	MAX_BATCH_ITEMS,
	MAX_MULTIPART_PART_BYTES,
	MAX_OBJECT_BYTES,
	MAX_SIGNED_URL_SECONDS,
	multipartUploadedPartSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	putObjectsInputSchema,
	putObjectsOutputSchema,
	signedUrlInputSchema,
	signedUrlOutputSchema,
	uploadPartInputSchema,
	uploadPartOutputSchema
}
export type {
	AbortMultipartUploadInput,
	AbortMultipartUploadOutput,
	CompleteMultipartUploadInput,
	CompleteMultipartUploadOutput,
	CopyObjectInput,
	CopyObjectOutput,
	CreateMultipartUploadInput,
	CreateMultipartUploadOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput,
	SignedUrlInput,
	SignedUrlOutput,
	UploadPartInput,
	UploadPartOutput
}

export const s3StorageAuthSchema = s3AuthSchema.extend({
	provider: z.literal('s3')
})

export const r2StorageAuthSchema = r2AuthSchema.extend({
	provider: z.literal('r2')
})

export const supabaseStorageSeamAuthSchema = supabaseStorageAuthSchema.extend({
	provider: z.literal('supabase')
})

export type S3StorageAuth = z.infer<typeof s3StorageAuthSchema>
export type R2StorageAuth = z.infer<typeof r2StorageAuthSchema>
export type SupabaseStorageSeamAuth = z.infer<typeof supabaseStorageSeamAuthSchema>

export const storageAuthSchema = z.discriminatedUnion('provider', [
	s3StorageAuthSchema,
	r2StorageAuthSchema,
	supabaseStorageSeamAuthSchema
])

export type StorageAuth = z.infer<typeof storageAuthSchema>

/** Shared seam surface — provider classes implement this (no ctx; auth is on the client). */
export type StorageOps = {
	list: (input: ListObjectsInput) => Promise<ListObjectsOutput>
	get: (input: GetObjectInput) => Promise<GetObjectOutput>
	put: (input: PutObjectInput) => Promise<PutObjectOutput>
	delete: (input: DeleteObjectInput) => Promise<DeleteObjectOutput>
	head: (input: HeadObjectInput) => Promise<HeadObjectOutput>
	copy: (input: CopyObjectInput) => Promise<CopyObjectOutput>
	createSignedUrl?: (input: SignedUrlInput) => Promise<SignedUrlOutput>
	createMultipartUpload?: (input: CreateMultipartUploadInput) => Promise<CreateMultipartUploadOutput>
	uploadPart?: (input: UploadPartInput) => Promise<UploadPartOutput>
	completeMultipartUpload?: (input: CompleteMultipartUploadInput) => Promise<CompleteMultipartUploadOutput>
	abortMultipartUpload?: (input: AbortMultipartUploadInput) => Promise<AbortMultipartUploadOutput>
	getBytes: (key: string) => Promise<Uint8Array>
	putBytes: (key: string, bytes: Uint8Array, contentType?: string) => Promise<void>
}
