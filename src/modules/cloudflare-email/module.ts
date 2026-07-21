import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'
import { httpRequest } from '../../http/client'

const emailAddressSchema = z.string().email().describe('Email address')

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

function normalizeAddressList(
	value: z.infer<typeof namedAddressSchema> | Array<z.infer<typeof namedAddressSchema>> | undefined
): Array<string | { email: string; name?: string }> | undefined {
	if (value === undefined) return undefined
	const list = Array.isArray(value) ? value : [value]
	return list.map((item) => {
		if (typeof item === 'string') return item
		if (item.name === undefined) return { email: item.email }
		return { email: item.email, name: item.name }
	})
}

function countRecipients(input: z.infer<typeof sendEmailInputSchema>): number {
	const size = (v: unknown): number => {
		if (v === undefined) return 0
		return Array.isArray(v) ? v.length : 1
	}
	return size(input.to) + size(input.cc) + size(input.bcc)
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function parseSendResult(data: unknown): z.infer<typeof sendEmailOutputSchema> {
	if (!isRecord(data)) {
		throw new ToolError('Cloudflare Email returned an unexpected payload', { code: 'upstream' })
	}
	if (data['success'] === false) {
		throw new ToolError('Cloudflare Email API rejected the send', {
			code: 'upstream',
			details: { success: false }
		})
	}
	const result = data['result']
	if (!isRecord(result)) {
		throw new ToolError('Cloudflare Email returned no result object', { code: 'upstream' })
	}
	return sendEmailOutputSchema.parse({
		success: data['success'] === true,
		delivered: Array.isArray(result['delivered']) ? result['delivered'] : [],
		queued: Array.isArray(result['queued']) ? result['queued'] : [],
		permanent_bounces: Array.isArray(result['permanent_bounces']) ? result['permanent_bounces'] : []
	})
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
		if (countRecipients(input) > 50) {
			throw new ToolError('Combined to/cc/bcc recipients cannot exceed 50', {
				code: 'bad_input'
			})
		}

		const auth = readAuth(ctx)
		const payload: Record<string, unknown> = {
			to: normalizeAddressList(input.to),
			from:
				typeof input.from === 'string'
					? input.from
					: { email: input.from.email, ...(input.from.name === undefined ? {} : { name: input.from.name }) },
			subject: input.subject
		}
		if (input.html !== undefined) payload['html'] = input.html
		if (input.text !== undefined) payload['text'] = input.text
		const cc = normalizeAddressList(input.cc)
		const bcc = normalizeAddressList(input.bcc)
		if (cc !== undefined) payload['cc'] = cc
		if (bcc !== undefined) payload['bcc'] = bcc
		if (input.reply_to !== undefined) {
			payload['reply_to'] =
				typeof input.reply_to === 'string'
					? input.reply_to
					: {
							email: input.reply_to.email,
							...(input.reply_to.name === undefined ? {} : { name: input.reply_to.name })
						}
		}
		if (input.headers !== undefined) payload['headers'] = input.headers
		if (input.attachments !== undefined) payload['attachments'] = input.attachments

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
