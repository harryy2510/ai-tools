# Messaging

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/messaging` |
| **Kind** | multi-provider **seam** (`src/modules/messaging`) |
| **Module id** | `messaging` |
| **Providers** | `telegram`, `slack`, `teams` |

Shared channel verbs over full vendor packs. Native-only APIs stay on the vendor packs ([telegram](../vendors/telegram.md), [slack](../vendors/slack.md), [teams](../vendors/teams.md)).

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { messagingModule, MessagingClient } from '@harryy/ai-tools/messaging'

withAuth(messagingModule, { provider: 'telegram', bot_token: '…' })
withAuth(messagingModule, { provider: 'slack', bot_token: 'xoxb-…' })
withAuth(messagingModule, {
  provider: 'teams',
  app_id: '…',
  app_password: '…',
  // tenant_id?: '…',
})

// Host client
const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: '…' })
await client.sendText({ chat_id: 'C…', text: 'hi' })
```

Teams connector calls require `service_url` on method inputs (from the inbound activity).

## Tools

| id | Method |
| --- | --- |
| `messaging-send-text` | `sendText` |
| `messaging-edit-text` | `editText` |
| `messaging-send-chat-action` | `sendChatAction` |
| `messaging-set-reaction` | `setReaction` |
| `messaging-clear-reaction` | `clearReaction` |
| `messaging-send-media` | `sendMedia` |
| `messaging-download-file` | `downloadFile` |
| `messaging-answer-callback` | `answerCallback` |

## Progressive text

```ts
import { createLiveMessage, MessagingClient } from '@harryy/ai-tools/messaging'
import { isTelegramDefiniteRejection, isTelegramOutcomeUnknown } from '@harryy/ai-tools/telegram'

const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection: isTelegramDefiniteRejection,
  isOutcomeUnknown: isTelegramOutcomeUnknown,
})
```

Use the matching vendor failure helpers for Slack / Teams when bound to those providers.
