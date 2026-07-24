import { describe, expect, test } from 'bun:test'

import { MessagingClient } from '../../../src/modules/messaging'
import { env } from '../env'

const tgToken = env('AI_TOOLS_TELEGRAM_BOT_TOKEN')
const tgChat = env('AI_TOOLS_TELEGRAM_CHAT_ID')
const runTg = tgToken ? describe : describe.skip

const slackToken = env('AI_TOOLS_SLACK_BOT_TOKEN')
const slackChannel = env('AI_TOOLS_SLACK_CHANNEL_ID')
const runSlack = slackToken ? describe : describe.skip

const imBase = env('AI_TOOLS_IMESSAGE_PROXY_URL')
const imProject = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const imSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const imChat = env('AI_TOOLS_IMESSAGE_CHAT_ID')
const runIm = imBase && imProject && imSecret && imChat ? describe : describe.skip

const teamsApp = env('AI_TOOLS_TEAMS_APP_ID')
const teamsPass = env('AI_TOOLS_TEAMS_APP_PASSWORD')
const teamsChat = env('AI_TOOLS_TEAMS_CHAT_ID')
const teamsService = env('AI_TOOLS_TEAMS_SERVICE_URL')
const runTeams = teamsApp && teamsPass ? describe : describe.skip

runTg('live seam messaging (telegram)', () => {
	test(
		'send edit action react media',
		async () => {
			if (!tgChat) return
			const client = MessagingClient.fromAuth({
				provider: 'telegram',
				bot_token: tgToken!
			})
			const msg = await client.sendText({
				chat_id: tgChat,
				text: `[ai-tools it] messaging tg ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()
			await client.editText({
				chat_id: tgChat,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging tg edited ${Date.now()}`
			})
			await client.sendChatAction({ chat_id: tgChat, action: 'typing' })
			await client.setReaction({
				chat_id: tgChat,
				message_id: msg.message_id,
				emoji: '👍'
			})
			await client.clearReaction({
				chat_id: tgChat,
				message_id: msg.message_id
			})
			const media = await client.sendMedia({
				chat_id: tgChat,
				kind: 'document',
				file_name: 'msg-tg.txt',
				body_base64: Buffer.from('tg').toString('base64')
			})
			expect(media.message_id).toBeTruthy()
		},
		{ timeout: 30_000 }
	)
})

runSlack('live seam messaging (slack)', () => {
	test(
		'send edit action react media',
		async () => {
			if (!slackChannel) return
			const client = MessagingClient.fromAuth({
				provider: 'slack',
				bot_token: slackToken!
			})
			const msg = await client.sendText({
				chat_id: slackChannel,
				text: `[ai-tools it] messaging slack ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()
			await client.editText({
				chat_id: slackChannel,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging slack edited ${Date.now()}`
			})
			await client.sendChatAction({ chat_id: slackChannel, action: 'typing' })
			await client.setReaction({
				chat_id: slackChannel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})
			await client.clearReaction({
				chat_id: slackChannel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})
			const media = await client.sendMedia({
				chat_id: slackChannel,
				kind: 'document',
				file_name: 'msg-slack.txt',
				body_base64: Buffer.from('slack').toString('base64')
			})
			expect(media.message_id).toBeTruthy()
		},
		{ timeout: 30_000 }
	)
})

runIm('live seam messaging (imessage)', () => {
	test(
		'sendText',
		async () => {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: imBase!,
				project_id: imProject!,
				project_secret: imSecret!,
				...(env('AI_TOOLS_IMESSAGE_PHONE') ? { phone: env('AI_TOOLS_IMESSAGE_PHONE') } : {})
			})
			const msg = await client.sendText({
				chat_id: imChat!,
				text: `[ai-tools it] messaging imessage ${Date.now()}`
			})
			expect(msg).toBeDefined()
		},
		{ timeout: 30_000 }
	)
})

runTeams('live seam messaging (teams)', () => {
	test(
		'send when chat + service_url set',
		async () => {
			if (!teamsChat || !teamsService) return
			const client = MessagingClient.fromAuth({
				provider: 'teams',
				app_id: teamsApp!,
				app_password: teamsPass!
			})
			const msg = await client.sendText({
				chat_id: teamsChat,
				service_url: teamsService,
				text: `[ai-tools it] messaging teams ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()
		},
		{ timeout: 30_000 }
	)
})
