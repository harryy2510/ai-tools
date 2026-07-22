/**
 * Cloudflare Email vendor client (Lane B — full pack, grow API over time).
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { HttpService } from '../../transport/http-service'
import type {
	CloudflareEmailAuth,
	CloudflareEmailSendBatchInput,
	CloudflareEmailSendBatchOutput,
	CloudflareEmailSendInput,
	CloudflareEmailSendOutput
} from './contracts'
import { cloudflareEmailAuthSchema } from './contracts'
import { assertEmailSize, assertRecipientLimit, normalizeAddressObject, normalizeAddressObjectList } from './domain'

export type CloudflareEmailClientOptions = {
	fetch?: FetchLike
	signal?: AbortSignal
}

function createCloudflareEmailService(auth: CloudflareEmailAuth, ctx: ToolContext) {
	const http = new HttpService({
		baseURL: 'https://api.cloudflare.com/client/v4',
		headers: {
			Authorization: `Bearer ${auth.api_token}`,
			'Content-Type': 'application/json'
		},
		label: 'Cloudflare Email',
		...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
		...(ctx.signal === undefined ? {} : { signal: ctx.signal })
	})
	return {
		sendEmail: (body: Record<string, unknown>) =>
			http.post(`/accounts/${encodeURIComponent(auth.account_id)}/email/sending/send`, body, {
				label: 'Cloudflare Email sendEmail'
			})
	}
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

function parseSendResult(data: unknown): CloudflareEmailSendOutput {
	if (!isPlainObject(data)) {
		throw new ToolError('Cloudflare Email returned an unexpected payload', { code: 'upstream' })
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
		throw new ToolError('Cloudflare Email returned no result object', { code: 'upstream' })
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

function buildPayload(input: CloudflareEmailSendInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		to: normalizeAddressObjectList(input.to),
		from: normalizeAddressObject(input.from),
		subject: input.subject
	}
	if (input.html !== undefined) payload['html'] = input.html
	if (input.text !== undefined) payload['text'] = input.text
	const cc = normalizeAddressObjectList(input.cc)
	const bcc = normalizeAddressObjectList(input.bcc)
	if (cc !== undefined) payload['cc'] = cc
	if (bcc !== undefined) payload['bcc'] = bcc
	if (input.reply_to !== undefined) payload['reply_to'] = normalizeAddressObject(input.reply_to)
	if (input.headers !== undefined) payload['headers'] = input.headers
	if (input.attachments !== undefined) payload['attachments'] = input.attachments
	return payload
}

export class CloudflareEmailClient {
	readonly #auth: CloudflareEmailAuth
	readonly #ctx: ToolContext

	constructor(auth: CloudflareEmailAuth, options: CloudflareEmailClientOptions = {}) {
		const parsed = cloudflareEmailAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Cloudflare Email auth credentials', {
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

	static fromContext(ctx: ToolContext): CloudflareEmailClient {
		const auth = requireAuth(ctx, cloudflareEmailAuthSchema)
		return new CloudflareEmailClient(auth, {
			...(ctx.fetch === undefined ? {} : { fetch: ctx.fetch }),
			...(ctx.signal === undefined ? {} : { signal: ctx.signal })
		})
	}

	async send(input: CloudflareEmailSendInput): Promise<CloudflareEmailSendOutput> {
		assertRecipientLimit(input)
		const payload = buildPayload(input)
		assertEmailSize(
			payload,
			input.attachments?.map((a) => a.content)
		)
		const { data } = await createCloudflareEmailService(this.#auth, this.#ctx).sendEmail(payload)
		return parseSendResult(data)
	}

	async sendBatch(input: CloudflareEmailSendBatchInput): Promise<CloudflareEmailSendBatchOutput> {
		return runBatchItems(input.messages, async (message) => this.send(message))
	}
}
