import { createMimeMessage } from 'mimetext'
import PostalMime from 'postal-mime'
import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64, utf8ToBytes } from '../../shared/bytes'

const addressSchema = z.object({
	address: z.string().email().describe('Email address'),
	name: z.string().optional().describe('Display name')
})

const parseInput = z.object({
	raw: z.string().min(1).describe('Raw RFC 822 / MIME message as utf8 text or base64'),
	encoding: z.enum(['utf8', 'base64']).optional().describe('How to decode raw. Defaults to utf8')
})

const parseOutput = z.object({
	subject: z.string().optional(),
	from: addressSchema.optional(),
	to: z.array(addressSchema).optional(),
	cc: z.array(addressSchema).optional(),
	text: z.string().optional(),
	html: z.string().optional(),
	attachments: z.array(
		z.object({
			filename: z.string().optional(),
			mimeType: z.string().optional(),
			size: z.number().optional(),
			content_base64: z.string().optional().describe('Attachment bytes as base64 when available')
		})
	)
})

const buildInput = z
	.object({
		from: z.union([z.string().email(), addressSchema]).describe('Sender address or { address, name }'),
		to: z
			.union([z.string().email(), addressSchema, z.array(z.union([z.string().email(), addressSchema])).min(1)])
			.describe('Recipient address, named address, or list'),
		subject: z.string().min(1).describe('Subject line'),
		text: z.string().optional().describe('Plain text body'),
		html: z.string().optional().describe('HTML body'),
		cc: z
			.union([z.string().email(), addressSchema, z.array(z.union([z.string().email(), addressSchema]))])
			.optional()
			.describe('CC recipients'),
		reply_to: z.union([z.string().email(), addressSchema]).optional().describe('Reply-To address')
	})
	.refine((v) => Boolean(v.text?.trim() || v.html?.trim()), {
		message: 'Provide text and/or html body'
	})

const buildOutput = z.object({
	raw: z.string().describe('Serialized MIME message')
})

function contentToBase64(content: unknown): { base64?: string; size?: number } {
	if (content === undefined || content === null) return {}
	if (typeof content === 'string') {
		const bytes = utf8ToBytes(content)
		return { base64: bytesToBase64(bytes), size: bytes.byteLength }
	}
	if (content instanceof ArrayBuffer) {
		const bytes = new Uint8Array(content)
		return { base64: bytesToBase64(bytes), size: bytes.byteLength }
	}
	if (content instanceof Uint8Array) {
		return { base64: bytesToBase64(content), size: content.byteLength }
	}
	return {}
}

function mapAddr(a: unknown): { address: string; name?: string } | undefined {
	if (typeof a !== 'object' || a === null) return undefined
	if (!('address' in a)) return undefined
	const address = a.address
	if (typeof address !== 'string' || address.length === 0) return undefined
	const name = 'name' in a && typeof a.name === 'string' ? a.name : undefined
	return name === undefined ? { address } : { address, name }
}

function mapAddrList(list: unknown): Array<{ address: string; name?: string }> {
	if (!Array.isArray(list)) return []
	const out: Array<{ address: string; name?: string }> = []
	for (const item of list) {
		const mapped = mapAddr(item)
		if (mapped !== undefined) out.push(mapped)
	}
	return out
}

function formatMailbox(value: unknown): string {
	if (typeof value === 'string') return value
	const mapped = mapAddr(value)
	if (mapped === undefined) {
		throw new ToolError('Invalid mailbox address', { code: 'bad_input' })
	}
	if (mapped.name === undefined || mapped.name.length === 0) return mapped.address
	return `${mapped.name} <${mapped.address}>`
}

function formatMailboxList(value: unknown): string[] {
	if (value === undefined) return []
	const items = Array.isArray(value) ? value : [value]
	return items.map((item) => formatMailbox(item))
}

const parseMimeTool = defineTool({
	id: 'mime-parse',
	name: 'parseMime',
	description:
		'Parse a raw MIME/RFC 822 email into structured headers, text/html bodies, and attachment metadata. Use when you need to inspect message content without sending mail.',
	inputSchema: parseInput,
	outputSchema: parseOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input) => {
		const bytes = input.encoding === 'base64' ? base64ToBytes(input.raw) : utf8ToBytes(input.raw)
		try {
			const parser = new PostalMime()
			const message = await parser.parse(bytes)
			const from = mapAddr(message.from)
			const html = typeof message.html === 'string' && message.html.length > 0 ? message.html : undefined
			return parseOutput.parse({
				...(message.subject === undefined ? {} : { subject: message.subject }),
				...(from === undefined ? {} : { from }),
				to: mapAddrList(message.to),
				cc: mapAddrList(message.cc),
				...(message.text === undefined ? {} : { text: message.text }),
				...(html === undefined ? {} : { html }),
				attachments: (message.attachments ?? []).map((att) => {
					const encoded = contentToBase64(att.content)
					return {
						...(att.filename === undefined ? {} : { filename: att.filename }),
						...(att.mimeType === undefined ? {} : { mimeType: att.mimeType }),
						...(encoded.size === undefined ? {} : { size: encoded.size }),
						...(encoded.base64 === undefined ? {} : { content_base64: encoded.base64 })
					}
				})
			})
		} catch (error) {
			throw new ToolError('Failed to parse MIME message', {
				code: 'bad_input',
				cause: error
			})
		}
	}
})

const buildMimeTool = defineTool({
	id: 'mime-build',
	name: 'buildMime',
	description:
		'Build a raw MIME email from structured sender, recipients, subject, and text/html bodies. Use when you need a serialized message for SMTP or archival. Provide text and/or html.',
	inputSchema: buildInput,
	outputSchema: buildOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		try {
			const msg = createMimeMessage()
			msg.setSender(formatMailbox(input.from))
			msg.setRecipients(formatMailboxList(input.to))
			const cc = formatMailboxList(input.cc)
			if (cc.length > 0) msg.setCc(cc)
			if (input.reply_to !== undefined) {
				msg.setHeader('Reply-To', formatMailbox(input.reply_to))
			}
			msg.setSubject(input.subject)
			if (input.text !== undefined) {
				msg.addMessage({ contentType: 'text/plain', data: input.text })
			}
			if (input.html !== undefined) {
				msg.addMessage({ contentType: 'text/html', data: input.html })
			}
			return buildOutput.parse({ raw: msg.asRaw() })
		} catch (error) {
			throw new ToolError('Failed to build MIME message', {
				code: 'bad_input',
				cause: error
			})
		}
	}
})

export const mimeModule = defineModule({
	id: 'mime',
	title: 'MIME',
	description: 'Parse and build RFC 822 / MIME email messages without sending them.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [parseMimeTool, buildMimeTool]
})

export { buildMimeTool, parseMimeTool }
