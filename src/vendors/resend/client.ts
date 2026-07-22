/**
 * Resend vendor client (Lane B — full pack, grow API over time).
 * Auth in constructor. Tools call ResendClient.fromContext(ctx).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { createServiceFetch, serviceRequestJson } from '../../shared/ofetch-client'
import type { ServiceHttp } from '../../shared/ofetch-client'
import type {
	ResendAuth,
	ResendSendBatchInput,
	ResendSendBatchOutput,
	ResendSendInput,
	ResendSendOutput
} from './contracts'
import { resendAuthSchema } from './contracts'
import { addressList, addressToString, assertEmailSize, assertRecipientLimit } from './domain'

export type ResendClientOptions = {
	fetch?: FetchLike
	signal?: AbortSignal
}

function createResendService(auth: ResendAuth, ctx: ToolContext) {
	const http: ServiceHttp = createServiceFetch(
		{
			baseURL: 'https://api.resend.com',
			headers: {
				Authorization: `Bearer ${auth.api_key}`,
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

function buildPayload(input: ResendSendInput): Record<string, unknown> {
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

export class ResendClient {
	readonly #auth: ResendAuth
	readonly #ctx: ToolContext

	constructor(auth: ResendAuth, options: ResendClientOptions = {}) {
		const parsed = resendAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Resend auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#ctx = {
			auth: this.#auth,
			...(options.fetch === undefined ? {} : { fetch: options.fetch }),
			...(options.signal === undefined ? {} : { signal: options.signal })
		}
	}

	static fromContext(ctx: ToolContext): ResendClient {
		const auth = requireAuth(ctx, resendAuthSchema)
		return new ResendClient(auth, {
			...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		})
	}

	async send(input: ResendSendInput): Promise<ResendSendOutput> {
		assertRecipientLimit(input)
		const payload = buildPayload(input)
		assertEmailSize(
			payload,
			input.attachments?.map((a) => a.content)
		)
		const { data } = await createResendService(this.#auth, this.#ctx).sendEmail(payload)
		if (!isPlainObject(data)) {
			throw new ToolError('Resend returned an unexpected payload', { code: 'upstream' })
		}
		const id = isString(data['id']) ? data['id'] : undefined
		return {
			success: true,
			...(id === undefined ? {} : { id })
		}
	}

	async sendBatch(input: ResendSendBatchInput): Promise<ResendSendBatchOutput> {
		return runBatchItems(input.messages, async (message) => this.send(message))
	}
}
