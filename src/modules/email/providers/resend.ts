import { isNil, isPlainObject, isString } from 'es-toolkit'
import { castArray } from 'es-toolkit/compat'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { utf8ToBytes } from '../../../shared/bytes'
import { runBatchItems } from '../../../shared/batch'
import { createServiceFetch, mapOfetchError } from '../../../shared/ofetch-client'
import { retryAfterMsFromHeader, throwHttpStatus } from '../../../shared/rate-limit'
import { MAX_EMAIL_BYTES } from '../contracts'
import type { EmailOps, NamedAddress, SendEmailInput, SendEmailOutput } from '../contracts'

export const resendEmailAuthSchema = z.object({
	provider: z.literal('resend'),
	apiKey: z.string().min(1).describe('Resend API key')
})

export type ResendEmailAuth = z.infer<typeof resendEmailAuthSchema>

function readAuth(ctx: ToolContext): ResendEmailAuth {
	const parsed = resendEmailAuthSchema.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('Resend credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

function addressToString(item: NamedAddress): string {
	if (isString(item)) return item
	return item.name === undefined ? item.email : `${item.name} <${item.email}>`
}

function addressList(value: NamedAddress | NamedAddress[] | undefined): string[] | undefined {
	if (isNil(value)) return undefined
	return castArray(value).map(addressToString)
}

function recipientCount(value: NamedAddress | NamedAddress[] | undefined): number {
	if (isNil(value)) return 0
	return castArray(value).length
}

function resendClient(auth: ResendEmailAuth, ctx: ToolContext) {
	return createServiceFetch(
		{
			baseURL: 'https://api.resend.com',
			headers: {
				Authorization: `Bearer ${auth.apiKey}`,
				'Content-Type': 'application/json'
			}
		},
		ctx
	)
}

async function sendOne(input: SendEmailInput, ctx: ToolContext): Promise<SendEmailOutput> {
	if (recipientCount(input.to) + recipientCount(input.cc) + recipientCount(input.bcc) > 50) {
		throw new ToolError('Combined to/cc/bcc recipients cannot exceed 50', { code: 'bad_input' })
	}

	const auth = readAuth(ctx)
	const to = addressList(input.to)
	const payload: Record<string, unknown> = {
		from: addressToString(input.from),
		to,
		subject: input.subject
	}
	if (input.html !== undefined) payload['html'] = input.html
	if (input.text !== undefined) payload['text'] = input.text
	const cc = addressList(input.cc)
	const bcc = addressList(input.bcc)
	if (cc !== undefined) payload['cc'] = cc
	if (bcc !== undefined) payload['bcc'] = bcc
	if (input.reply_to !== undefined) payload['reply_to'] = addressToString(input.reply_to)
	if (input.headers !== undefined) payload['headers'] = input.headers
	if (input.attachments !== undefined) {
		payload['attachments'] = input.attachments.map((att) => ({
			filename: att.filename,
			content: att.content,
			content_type: att.type,
			...(att.disposition === undefined ? {} : { content_disposition: att.disposition })
		}))
	}

	const bytes = utf8ToBytes(JSON.stringify(payload)).byteLength
	if (bytes > MAX_EMAIL_BYTES) {
		throw new ToolError('Email payload exceeds 5 MiB limit', {
			code: 'too_large',
			details: { bytes, max_bytes: MAX_EMAIL_BYTES }
		})
	}

	const $fetch = resendClient(auth, ctx)
	try {
		const res = await $fetch.raw('/emails', { method: 'POST', body: payload })
		if (!res.ok) {
			throwHttpStatus('Resend send', res.status, retryAfterMsFromHeader(res.headers.get('retry-after')))
		}
		const data: unknown = res._data
		const id = isPlainObject(data) && isString(data['id']) ? data['id'] : undefined
		const accepted = to ?? []
		return {
			success: true,
			...(id === undefined ? {} : { id }),
			...(accepted.length > 0 ? { accepted } : {})
		}
	} catch (error) {
		mapOfetchError(error, 'Resend')
	}
}

const ops: EmailOps = {
	send: sendOne,
	sendBatch: async (input, ctx) => runBatchItems(input.messages, async (message) => sendOne(message, ctx))
}

export const resendEmailProvider = defineProvider({
	id: 'resend',
	title: 'Resend',
	authSchema: resendEmailAuthSchema,
	ops
})
