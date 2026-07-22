# Telegram

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/telegram` |
| **Kind** | messaging pack (prefer `src/modules/telegram`; may live under `src/messaging/` until moved) |
| **Module id** | `telegram` |
| **Auth** | Host: `{ bot_token }` |

Full Telegram Bot API **channel pack** (not a thin send wrapper). Implements shared transport method names so a future `messaging` seam is wiring only.

HTTP uses the package **ofetch service** pattern: `createTelegramService` (endpoint methods) → domain `createTelegramClient` (no raw fetch).

## Bind

```ts
import { telegramModule, createTelegramClient, createLiveMessage, withAuth } from '@harryy/ai-tools/telegram'
// withAuth from @harryy/ai-tools/core

withAuth(telegramModule, { bot_token: '…' })
```

## Shared transport methods (client)

Same names on every channel pack:

| Method | Tool id |
| --- | --- |
| `sendText` | `telegram-send-text` |
| `editText` | `telegram-edit-text` |
| `sendChatAction` | `telegram-send-chat-action` |
| `setReaction` | `telegram-set-reaction` (**any emoji**) |
| `clearReaction` | `telegram-clear-reaction` |
| `sendMedia` | `telegram-send-media` |
| `downloadFile` | `telegram-download-file` |
| `answerCallback` | `telegram-answer-callback` |

## Telegram-only

| Method / helper | Tool / export |
| --- | --- |
| `sendMediaGroup` | `telegram-send-media-group` |
| `getBot` | `telegram-get-bot` |
| `getWebhookInfo` / `setWebhook` / `deleteWebhook` | client only (connection UI) |
| `verifyTelegramWebhookSecret` | pure helper |
| `parseTelegramUpdate` | pure helper → normalized inbound event |
| `createLiveMessage` | progressive `start` / `update` / `finalize` |
| `createTypingPulse` | renew chat action while work runs |

## Live progressive text

```ts
const client = createTelegramClient({ botToken: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection,
  isOutcomeUnknown,
})
await live.start('…')
await live.update('…partial…')
const { message_id } = await live.finalize('…final…')
```

## Webhook

```ts
if (!verifyTelegramWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'), secret)) {
  return new Response('unauthorized', { status: 401 })
}
const parsed = parseTelegramUpdate(await request.json())
if (!parsed.ok) return new Response('ignored', { status: 200 })
// host: durable accept + route parsed.event
```

## Host still owns

Vault, HTTP route registration, tenant/agent map, FIFO cohorts, durable send claim, which emoji for lifecycle phases, album settlement durability.
