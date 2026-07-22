import { AwsClient } from 'aws4fetch'
import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'
import { z } from 'zod'

import { defineProvider } from '../core/provider'
import { ToolError } from '../core/errors'
import type { ToolContext } from '../core/types'
import { runBatchItems } from '../shared/batch'
import type {
	DocumentExtractOps,
	ExtractResult,
	ExtractTextInput,
	StatusInput
} from '../modules/document-extract/contracts'
import { extractResultSchema } from '../modules/document-extract/contracts'

const DEFAULT_POLL_TIMEOUT_MS = 60_000
const DEFAULT_POLL_INTERVAL_MS = 2_000
const MAX_POLL_TIMEOUT_MS = 900_000
const MAX_POLL_INTERVAL_MS = 30_000

export const textractExtractAuthSchema = z.object({
	provider: z.literal('textract'),
	accessKeyId: z.string().min(1).describe('AWS access key id'),
	secretAccessKey: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for Textract and the source S3 bucket'),
	bucket: z.string().min(1).describe('AWS S3 bucket containing source documents'),
	sessionToken: z.string().min(1).optional().describe('Optional session token'),
	poll_timeout_ms: z
		.int()
		.min(1_000)
		.max(MAX_POLL_TIMEOUT_MS)
		.optional()
		.describe('Max time to wait for Textract before returning pending + job_id (default 60000)'),
	poll_interval_ms: z
		.int()
		.min(200)
		.max(MAX_POLL_INTERVAL_MS)
		.optional()
		.describe('Delay between GetDocumentTextDetection polls (default 2000)')
})

export type TextractExtractAuth = z.infer<typeof textractExtractAuthSchema>

function readAuth(ctx: ToolContext): TextractExtractAuth {
	const parsed = textractExtractAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Textract credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function clientFor(auth: TextractExtractAuth, service: string): AwsClient {
	return new AwsClient({
		accessKeyId: auth.accessKeyId,
		secretAccessKey: auth.secretAccessKey,
		region: auth.region,
		service,
		...(auth.sessionToken === undefined ? {} : { sessionToken: auth.sessionToken })
	})
}

async function textractJson(
	auth: TextractExtractAuth,
	target: string,
	body: Record<string, unknown>,
	ctx: ToolContext
): Promise<Record<string, unknown>> {
	const aws = clientFor(auth, 'textract')
	const url = `https://textract.${auth.region}.amazonaws.com/`
	try {
		const response = await aws.fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-amz-json-1.1',
				'X-Amz-Target': target
			},
			body: JSON.stringify(body),
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		})
		const text = await response.text()
		let data: unknown
		try {
			data = text ? JSON.parse(text) : {}
		} catch {
			data = { message: text }
		}
		if (!response.ok) {
			const message =
				typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
					? data.message
					: `Textract HTTP ${response.status}`
			throw new ToolError(message, {
				code: response.status === 403 ? 'forbidden' : response.status === 400 ? 'bad_input' : 'upstream',
				retryable: response.status >= 500 || response.status === 429,
				details: { status: response.status }
			})
		}
		if (!isPlainObject(data)) {
			throw new ToolError('Textract returned a non-object payload', { code: 'upstream' })
		}
		return data
	} catch (error) {
		if (error instanceof ToolError) throw error
		throw new ToolError('Textract request failed', { code: 'upstream', retryable: true, cause: error })
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

function lineTextFromBlocks(payload: Record<string, unknown>): { text: string; page_count?: number } {
	const blocks = payload['Blocks']
	const lines: string[] = []
	if (isArray(blocks)) {
		for (const block of blocks) {
			if (!isPlainObject(block)) continue
			if (block['BlockType'] !== 'LINE') continue
			const t = block['Text']
			if (isString(t) && t.length > 0) lines.push(t)
		}
	}
	const meta = payload['DocumentMetadata']
	let page_count: number | undefined
	if (isPlainObject(meta) && typeof meta['Pages'] === 'number' && Number.isFinite(meta['Pages'])) {
		page_count = meta['Pages']
	}
	return {
		text: lines.join('\n'),
		...(page_count === undefined ? {} : { page_count })
	}
}

async function getJobPayload(
	auth: TextractExtractAuth,
	jobId: string,
	ctx: ToolContext
): Promise<Record<string, unknown>> {
	const allBlocks: unknown[] = []
	let nextToken: string | undefined
	let jobStatus = 'IN_PROGRESS'
	let page_count: number | undefined

	do {
		const body: Record<string, unknown> = {
			JobId: jobId,
			MaxResults: 1000,
			...(nextToken === undefined ? {} : { NextToken: nextToken })
		}
		const page = await textractJson(auth, 'Textract.GetDocumentTextDetection', body, ctx)
		const status = page['JobStatus']
		if (isString(status)) jobStatus = status

		const blocks = page['Blocks']
		if (isArray(blocks)) allBlocks.push(...blocks)

		const meta = page['DocumentMetadata']
		if (isPlainObject(meta) && typeof meta['Pages'] === 'number') {
			page_count = meta['Pages']
		}

		const token = page['NextToken']
		nextToken = isString(token) && token.length > 0 ? token : undefined
		if (jobStatus !== 'SUCCEEDED' && jobStatus !== 'PARTIAL_SUCCESS') {
			nextToken = undefined
		}
	} while (nextToken !== undefined)

	return {
		JobStatus: jobStatus,
		Blocks: allBlocks,
		...(page_count === undefined ? {} : { DocumentMetadata: { Pages: page_count } })
	}
}

function mapStatus(jobStatus: string): 'succeeded' | 'pending' | 'failed' {
	if (jobStatus === 'SUCCEEDED' || jobStatus === 'PARTIAL_SUCCESS') return 'succeeded'
	if (jobStatus === 'FAILED') return 'failed'
	return 'pending'
}

async function extractText(input: ExtractTextInput, ctx: ToolContext): Promise<ExtractResult> {
	const auth = readAuth(ctx)
	if (input.source.store !== 'object') {
		throw new ToolError('document-extract requires source.store "object"', { code: 'bad_input' })
	}

	const start = await textractJson(
		auth,
		'Textract.StartDocumentTextDetection',
		{
			DocumentLocation: {
				S3Object: {
					Bucket: auth.bucket,
					Name: input.source.key
				}
			}
		},
		ctx
	)

	const jobId = start['JobId']
	if (!isString(jobId) || jobId.length === 0) {
		throw new ToolError('Textract did not return a JobId', { code: 'upstream' })
	}

	const timeoutMs = auth.poll_timeout_ms ?? DEFAULT_POLL_TIMEOUT_MS
	const intervalMs = auth.poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS
	const deadline = Date.now() + timeoutMs

	try {
		while (Date.now() < deadline) {
			const payload = await getJobPayload(auth, jobId, ctx)
			const statusRaw = payload['JobStatus']
			const status = isString(statusRaw) ? mapStatus(statusRaw) : 'pending'

			if (status === 'succeeded') {
				const { text, page_count } = lineTextFromBlocks(payload)
				return extractResultSchema.parse({
					status: 'succeeded',
					job_id: jobId,
					text,
					...(page_count === undefined ? {} : { page_count }),
					source: input.source
				})
			}
			if (status === 'failed') {
				const msg = payload['StatusMessage']
				return extractResultSchema.parse({
					status: 'failed',
					job_id: jobId,
					error: isString(msg) ? msg : 'Textract job failed',
					source: input.source
				})
			}

			const remaining = deadline - Date.now()
			if (remaining <= 0) break
			await sleep(Math.min(intervalMs, remaining), ctx.signal)
		}
	} catch (error) {
		if (error instanceof ToolError) throw error
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ToolError('Document extract was aborted', {
				code: 'timeout',
				retryable: true,
				cause: error
			})
		}
		throw error
	}

	return extractResultSchema.parse({
		status: 'pending',
		job_id: jobId,
		source: input.source
	})
}

async function getStatus(input: StatusInput, ctx: ToolContext): Promise<ExtractResult> {
	const auth = readAuth(ctx)
	const payload = await getJobPayload(auth, input.job_id, ctx)
	const statusRaw = payload['JobStatus']
	const status = isString(statusRaw) ? mapStatus(statusRaw) : 'pending'

	if (status === 'succeeded') {
		const { text, page_count } = lineTextFromBlocks(payload)
		return extractResultSchema.parse({
			status: 'succeeded',
			job_id: input.job_id,
			text,
			...(page_count === undefined ? {} : { page_count })
		})
	}
	if (status === 'failed') {
		const msg = payload['StatusMessage']
		return extractResultSchema.parse({
			status: 'failed',
			job_id: input.job_id,
			error: isString(msg) ? msg : 'Textract job failed'
		})
	}
	return extractResultSchema.parse({
		status: 'pending',
		job_id: input.job_id
	})
}

const ops: DocumentExtractOps = {
	extractText,
	getStatus,
	extractTextBatch: async (input, ctx) => runBatchItems(input.sources, async (source) => extractText({ source }, ctx))
}

export const textractExtractProvider = defineProvider({
	id: 'textract',
	title: 'Amazon Textract',
	authSchema: textractExtractAuthSchema,
	ops
})
