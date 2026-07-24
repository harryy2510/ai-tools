import { describe, expect, test } from 'bun:test'

import { EmailClient } from '../../../src/modules/email'
import { env } from '../env'

const resendKey = env('AI_TOOLS_RESEND_API_KEY')
const from = env('AI_TOOLS_RESEND_FROM')
const to = env('AI_TOOLS_RESEND_TO')
const run = resendKey && from && to ? describe : describe.skip

run('live seam email (resend)', () => {
	test('send via provider=resend', async () => {
		const client = EmailClient.fromAuth({
			provider: 'resend',
			api_key: resendKey!
		})
		const out = await client.send({
			from: from!,
			to: to!,
			subject: `[ai-tools it] email seam ${Date.now()}`,
			text: 'email seam integration'
		})
		expect(out).toBeDefined()
	})
})
