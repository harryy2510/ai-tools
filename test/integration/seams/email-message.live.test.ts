import { describe, expect, test } from 'bun:test'

import { runTool, withAuth } from '../../../src/core'
import { emailMessageModule } from '../../../src/modules/email-message'

describe('live seam email-message', () => {
	test('parse and build', async () => {
		const bound = withAuth(emailMessageModule)
		const build = bound.tools.find((t) => t.id === 'email-message-build')
		const parse = bound.tools.find((t) => t.id === 'email-message-parse')
		if (!build || !parse) throw new Error('missing email-message tools')

		const built = (await runTool(build, {
			from: { address: 'a@example.com' },
			to: [{ address: 'b@example.com' }],
			subject: 'it',
			text: 'hello'
		})) as { raw: string }

		expect(built.raw).toContain('Subject:')

		const parsed = (await runTool(parse, { raw: built.raw })) as { subject?: string }
		expect(parsed.subject).toBe('it')
	})
})
