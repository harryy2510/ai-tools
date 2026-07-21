import { isNil, isPlainObject, isString } from 'es-toolkit'
import { castArray, isArray } from 'es-toolkit/compat'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { utf8ToBytes } from '../../../shared/bytes'
import { runBatchItems } from '../../../shared/batch'
import { createServiceFetch, mapOfetchError } from '../../../shared/ofetch-client'
import { throwHttpStatus, retryAfterMsFromHeader } from '../../../shared/rate-limit'
import { MAX_EMAIL_BYTES } from '../contracts'
import type { EmailOps, NamedAddress, SendEmailInput, SendEmailOutput } from '../contracts'

export const cloudflareEmailAuthSchema = z.object({
	provider: z.literal('cloudflare'),
	accountId: z.string().min(1).describe('Cloudflare account id'),
	apiToken: z.string().min(1).describe('Cloudflare API token with Email Sending permission')
})

export type CloudflareEmailAuth = z.infer<typeof cloudflareEmailAuthSchema>

function normalizeAddress(item: NamedAddress): string | { email: string; name?: string } {
	if (isString(item)) return item
	return item.name === undefined ? { email: item.email } : { email: item.email, name: item.name }
}

function normalizeAddressList(
	value: NamedAddress | NamedAddress[] | undefined
): Array<string | { email: string; name?: string }> | undefined {
	if (isNil(value)) return undefined
	return castArray(value).map(normalizeAddress)
}

function recipientCount(value: NamedAddress | NamedAddress[] | undefined): number {
	if (isNil(value)) return 0
	return castArray(value).length
}

function readAuth(ctx: ToolContext): CloudflareEmailAuth {
	const parsed = cloudflareEmailAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Cloudflare Email credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function cloudflareClient(auth: CloudflareEmailAuth, ctx: ToolContext) {
	return createServiceFetch(
		{
			baseURL: 'https://api.cloudflare.com/client/v4',
			headers: {
				Authorization: `Bearer ${auth.apiToken}`,
				'Content-Type': 'application/json'
			}
		},
		ctx
	)
}

function stringArray(value: unknown): string[] {
	return isArray(value) ? value.filter(isString) : []
}

function firstErrorMessage(errors: unknown): string | undefined {
	if (!isArray(errors) || errors.length === 0) return undefined
	const first = errors[0]
	if (!isPlainObject(first)) return undefined
	const message = first['message']
	return isString(message) && message.length > 0 ? message : undefined
}

function firstErrorCode(errors: unknown): number | undefined {
	if (!isArray(errors) || errors.length === 0) return undefined
	const first = errors[0]
	if (!isPlainObject(first)) return undefined
	const code = first['code']
	return typeof code === 'number' && Number.isFinite(code) ? code : undefined
}

function parseSendResult(data: unknown): SendEmailOutput {
	if (!isPlainObject(data)) {
		throw new ToolError('Email provider returned an unexpected payload', { code: 'upstream' })
	}
	if (data['success'] === false) {
		const errors = data['errors']
		const message = firstErrorMessage(errors) ?? 'Email API rejected the send'
		const cfCode = firstErrorCode(errors)
		const lower = message.toLowerCase()
		const code =
			lower.includes('unauthorized') || lower.includes('authentication') || cfCode === 10000
				? 'bad_auth'
				: lower.includes('forbidden') || lower.includes('permission')
					? 'forbidden'
					: lower.includes('rate') || lower.includes('too many')
						? 'rate_limited'
						: lower.includes('too large') || lower.includes('size')
							? 'too_large'
							: 'upstream'
		throw new ToolError(message, {
			code,
			retryable: code === 'rate_limited',
			details: {
				success: false,
				...(cfCode === undefined ? {} : { cloudflare_error_code: cfCode })
			}
		})
	}
	const result = data['result']
	if (!isPlainObject(result)) {
		throw new ToolError('Email provider returned no result object', { code: 'upstream' })
	}
	const delivered = stringArray(result['delivered'])
	const queued = stringArray(result['queued'])
	const rejected = stringArray(result['permanent_bounces'])
	const accepted = [...delivered, ...queued]
	return {
		success: data['success'] === true,
		...(accepted.length > 0 ? { accepted } : {}),
		...(rejected.length > 0 ? { rejected } : {})
	}
}

function assertPayloadSize(payload: Record<string, unknown>): void {
	const bytes = utf8ToBytes(JSON.stringify(payload)).byteLength
	if (bytes > MAX_EMAIL_BYTES) {
		throw new ToolError('Email payload exceeds 5 MiB limit', {
			code: 'too_large',
			details: { bytes, max_bytes: MAX_EMAIL_BYTES }
		})
	}
}

async function sendOne(input: SendEmailInput, ctx: ToolContext): Promise<SendEmailOutput> {
	if (recipientCount(input.to) + recipientCount(input.cc) + recipientCount(input.bcc) > 50) {
		throw new ToolError('Combined to/cc/bcc recipients cannot exceed 50', {
			code: 'bad_input'
		})
	}

	const auth = readAuth(ctx)
	const payload: Record<string, unknown> = {
		to: normalizeAddressList(input.to),
		from: normalizeAddress(input.from),
		subject: input.subject
	}
	if (input.html !== undefined) payload['html'] = input.html
	if (input.text !== undefined) payload['text'] = input.text
	const cc = normalizeAddressList(input.cc)
	const bcc = normalizeAddressList(input.bcc)
	if (cc !== undefined) payload['cc'] = cc
	if (bcc !== undefined) payload['bcc'] = bcc
	if (input.reply_to !== undefined) {
		payload['reply_to'] = normalizeAddress(input.reply_to)
	}
	if (input.headers !== undefined) payload['headers'] = input.headers
	if (input.attachments !== undefined) payload['attachments'] = input.attachments

	assertPayloadSize(payload)

	const $fetch = cloudflareClient(auth, ctx)
	try {
		const res = await $fetch.raw(`/accounts/${encodeURIComponent(auth.accountId)}/email/sending/send`, {
			method: 'POST',
			body: payload
		})
		if (!res.ok) {
			throwHttpStatus('Cloudflare Email send', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
		}
		return parseSendResult(res._data)
	} catch (error) {
		mapOfetchError(error, 'Cloudflare Email')
	}
}

const ops: EmailOps = {
	send: sendOne,
	sendBatch: async (input, ctx) => runBatchItems(input.messages, async (message) => sendOne(message, ctx))
}

export const cloudflareEmailProvider = defineProvider({
	id: 'cloudflare',
	title: 'Cloudflare Email',
	authSchema: cloudflareEmailAuthSchema,
	ops
})
