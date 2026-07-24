import { describe, expect, test } from 'bun:test'

import { TeamsClient } from '../../../src/vendors/teams'
import { env } from '../env'

const appId = env('AI_TOOLS_TEAMS_APP_ID')
const appPassword = env('AI_TOOLS_TEAMS_APP_PASSWORD')
const run = appId && appPassword ? describe : describe.skip

run('live vendor teams', () => {
	test('getBot (token + profile)', async () => {
		const client = new TeamsClient({
			app_id: appId!,
			app_password: appPassword!
		})
		const bot = await client.getBot()
		expect(bot).toBeDefined()
	})
})
