import type { z } from 'zod'

import type { ToolContext } from '../../core/types'
import { s3StorageAuthSchema, s3StorageProvider } from '../storage/providers/s3'

export const renderStorageAuthSchema = s3StorageAuthSchema

export type RenderStorageAuth = z.infer<typeof renderStorageAuthSchema>

export async function putRenderBytes(
	storage: RenderStorageAuth,
	key: string,
	bytes: Uint8Array,
	contentType: string,
	ctx: ToolContext
): Promise<void> {
	await s3StorageProvider.ops.putBytes(key, bytes, contentType, { ...ctx, auth: storage })
}

export function defaultRenderKey(kind: 'pdf' | 'screenshot', outputKey: string | undefined): string {
	if (outputKey !== undefined && outputKey.length > 0) return outputKey
	const stamp = Date.now()
	return kind === 'pdf' ? `renders/${stamp}.pdf` : `renders/${stamp}.png`
}
