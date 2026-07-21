import { isNil, isPlainObject, isString } from 'es-toolkit'
import { castArray, isArray } from 'es-toolkit/compat'
import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { httpRequest } from '../../http/client'
import { utf8ToBytes } from '../../shared/bytes'

const MAX_EMAIL_BYTES = 5 * 1024 * 1024

const emailAddressSchema = z.email().describe('Email address')

const namedAddressSchema = z.union([
	emailAddressSchema,
	z.object({
		email: emailAddressSchema,
		name: z.string().max(200).optional().describe('Display name')
	})
])

const attachmentSchema = z.object({
	content: z.string().min(1).describe('Base64-encoded file bytes (no data: URL prefix)'),
	filename: z.string().min(1).max(255).describe('Attachment file name'),
	type: z.string().min(1).describe('MIME type, for example application/pdf'),
	disposition: z.enum(['attachment', 'inline']).optional().describe('Content disposition. Defaults to attachment')
})

export const cloudflareEmailAuthSchema = z.object({
	accountId: z.string().min(1).describe('Cloudflare account id'),
	apiToken: z.string().min(1).describe('Cloudflare API token with Email Sending permission')
})

export type CloudflareEmailAuth = z.infer<typeof cloudflareEmailAuthSchema>

const sendEmailInputSchema = z
	.object({
		to: z
			.union([namedAddressSchema, z.array(namedAddressSchema).min(1).max(50)])
			.describe('Primary recipient address or list (max 50 combined to/cc/bcc)'),
		from: namedAddressSchema.describe('Verified sender address on the Cloudflare sending domain'),
		subject: z.string().min(1).max(998).describe('Email subject line'),
		html: z.string().optional().describe('HTML body. Provide html and/or text'),
		text: z.string().optional().describe('Plain text body. Provide html and/or text'),
		cc: z
			.union([namedAddressSchema, z.array(namedAddressSchema).max(50)])
			.optional()
			.describe('CC recipients'),
		bcc: z
			.union([namedAddressSchema, z.array(namedAddressSchema).max(50)])
			.optional()
			.describe('BCC recipients'),
		reply_to: namedAddressSchema.optional().describe('Reply-To address'),
		headers: z.record(z.string(), z.string()).optional().describe('Allowlisted or X- custom headers as a string map'),
		attachments: z
			.array(attachmentSchema)
			.max(32)
			.optional()
			.describe('Up to 32 base64 attachments. Total message must stay under 5 MiB')
	})
	.refine((v) => Boolean(v.html?.trim() || v.text?.trim()), {
		message: 'Provide html and/or text body'
	})

const sendEmailOutputSchema = z.object({
	success: z.boolean().describe('Whether the Cloudflare API accepted the request'),
	delivered: z.array(z.string()).describe('Addresses delivered immediately'),
	queued: z.array(z.string()).describe('Addresses queued for later delivery'),
	permanent_bounces: z.array(z.string()).describe('Addresses that permanently bounced')
})

type NamedAddress = z.infer<typeof namedAddressSchema>

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
		throw new ToolError('Cloudflare Email credentials are missing or invalid', {
			code: 'bad_auth'
		})
	}
	return parsed.data
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

function parseSendResult(data: unknown): z.infer<typeof sendEmailOutputSchema> {
	if (!isPlainObject(data)) {
		throw new ToolError('Cloudflare Email returned an unexpected payload', { code: 'upstream' })
	}
	if (data['success'] === false) {
		const errors = data['errors']
		const message = firstErrorMessage(errors) ?? 'Cloudflare Email API rejected the send'
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
		throw new ToolError('Cloudflare Email returned no result object', { code: 'upstream' })
	}
	return sendEmailOutputSchema.parse({
		success: data['success'] === true,
		delivered: stringArray(result['delivered']),
		queued: stringArray(result['queued']),
		permanent_bounces: stringArray(result['permanent_bounces'])
	})
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

const sendEmailTool = defineTool({
	id: 'cloudflare-email-send',
	name: 'sendEmail',
	description:
		'Send one transactional email through Cloudflare Email Service. Use for single messages with subject and html/text body. Supports optional cc, bcc, reply_to, headers, and base64 attachments. Total message size must stay under 5 MiB. Returns delivered, queued, and bounce address lists.',
	inputSchema: sendEmailInputSchema,
	outputSchema: sendEmailOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => {
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

		const { data } = await httpRequest(
			{
				baseUrl: 'https://api.cloudflare.com/client/v4',
				method: 'POST',
				path: `/accounts/${encodeURIComponent(auth.accountId)}/email/sending/send`,
				headers: {
					Authorization: `Bearer ${auth.apiToken}`
				},
				body: payload,
				...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
				...(ctx.fetch === undefined ? {} : { fetchImpl: ctx.fetch })
			},
			ctx
		)

		return parseSendResult(data)
	}
})

export const cloudflareEmailModule = defineModule({
	id: 'cloudflare-email',
	title: 'Cloudflare Email',
	description: 'Send transactional email through Cloudflare Email Service REST API.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareEmailAuthSchema },
	tools: [sendEmailTool]
})

export { sendEmailTool }
