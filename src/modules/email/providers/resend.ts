import { isPlainObject, isString } from 'es-toolkit'
import { z } from 'zod'

import { defineProvider } from '../../../core/provider'
import { ToolError } from '../../../core/errors'
import type { ToolContext } from '../../../core/types'
import { runBatchItems } from '../../../shared/batch'
import { createServiceFetch, serviceRequestJson } from '../../../shared/ofetch-client'
import type { ServiceHttp } from '../../../shared/ofetch-client'
import type { EmailOps, SendEmailInput, SendEmailOutput } from '../contracts'
import { addressList, addressToString, assertEmailSize, assertRecipientLimit } from '../domain'

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

/** Private ofetch service — endpoint methods only. */
function createResendService(auth: ResendEmailAuth, ctx: ToolContext) {
	const http: ServiceHttp = createServiceFetch(
		{
			baseURL: 'https://api.resend.com',
			headers: {
				Authorization: `Bearer ${auth.apiKey}`,
				'Content-Type': 'application/json'
			}
		},
		ctx
	)
	return {
		sendEmail: (body: Record<string, unknown>) =>
			serviceRequestJson(http, 'Resend sendEmail', '/emails', { method: 'POST', body })
	}
}

function buildPayload(input: SendEmailInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		from: addressToString(input.from),
		to: addressList(input.to),
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
	return payload
}

async function sendOne(input: SendEmailInput, ctx: ToolContext): Promise<SendEmailOutput> {
	assertRecipientLimit(input)
	const auth = readAuth(ctx)
	const payload = buildPayload(input)
	const attachmentBodies = input.attachments?.map((a) => a.content)
	assertEmailSize(payload, attachmentBodies)

	const { data } = await createResendService(auth, ctx).sendEmail(payload)
	if (!isPlainObject(data)) {
		throw new ToolError('Resend returned an unexpected payload', { code: 'upstream' })
	}
	const id = isString(data['id']) ? data['id'] : undefined
	// Do not invent accepted[] from `to` — only return provider-backed fields.
	return {
		success: true,
		...(id === undefined ? {} : { id })
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
