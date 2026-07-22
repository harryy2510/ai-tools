# Spec: Package surface architecture (modules · vendors · channels)

Status: **locked for implementation**  
Package: `@harryy/ai-tools`  
Date: 2026-07-22  

Related:

- [provider-seam.md](./provider-seam.md) — multi-provider capability modules only  
- [artifacts-extract-convert.md](./artifacts-extract-convert.md) — ArtifactRef pipelines  
- [ofetch-services.md](../reference/ofetch-services.md) — HTTP client pattern  
- **Working delivery board:** [package-surface-working.md](../roadmap/package-surface-working.md) — inventory, migration, checklists, open questions  
- Host product context (Five Star): connector seam (Composio + Nango), channel productionization specs  

### What this doc is vs is not

| This architecture spec | Working doc |
| --- | --- |
| Locked lanes, ownership, patterns, non-goals, build preference | Living inventory, slice status, FSS migration map, open questions |
| Change only when a product decision changes | Update every delivered slice |

---

## Goals

1. One package, three **lanes** so platform primitives, fat vendor APIs, and product messaging are not forced into one taxonomy.
2. Keep **Composio / Nango** as the OAuth SaaS catalog and PHI routing path; this package owns first-party HTTP/SigV4, self-hostable services, and channels the host operates.
3. Make **channel messaging** complete: not “webhook only” — inbound parse, outbound tools, media, edits, and host-owned durable delivery.
4. Prefer **self-hostable providers** for document render, convert, extract, speech, browser, and vectors, with managed clouds as optional providers.
5. Preserve kernel rules: auth host-bound, adapters generic, ofetch/aws4fetch services, stable tool ids.

---

## Non-goals

- Replacing Composio/Nango for broad SaaS OAuth catalogs.
- Encoding tenant RLS, org membership, agent allowlists, or PHI policy in this package (host owns those).
- Forcing huge APIs (Amazon SP-API, full Slack API) into a five-tool generic “commerce” or “chat” facade.
- Owning Mastra Memory / pgvector product schema (host owns stores; package exposes tools/clients).

---

## The three lanes

```text
@harryy/ai-tools
├── modules/     Platform capabilities (generic tools + multi-provider seam)
├── vendors/     First-party vendor packs (full API surface, incremental tools)
└── channels/    Product messaging transports (inbound + outbound tooling)
```

| Lane | Source path | Module id style | When to use |
| --- | --- | --- | --- |
| **Platform** | `src/modules/<capability>/` | Capability name (`email`, `storage`) | Small stable contracts; 2+ swappable providers |
| **Vendor** | `src/vendors/<vendor>/` | Vendor name (`amazon-sp-api`, `woocommerce`) | Fat first-party APIs; map the real API; grow tools over time |
| **Channel** | `src/channels/<channel>/` | Channel name (`telegram`, `slack`) | Product chat transports; webhook + agent tools |

Public imports stay **flat** regardless of source lane:

```ts
import { emailModule } from '@harryy/ai-tools/email'
import { amazonSpApiModule } from '@harryy/ai-tools/amazon-sp-api'
import { telegramModule } from '@harryy/ai-tools/telegram'
```

Codegen discovers `modules/*`, `vendors/*`, and `channels/*` (implementation follow-up).

### How this relates to Composio / Nango

| Concern | Owner |
| --- | --- |
| Logical tool catalog for SaaS OAuth apps | Host + Composio/Nango seam |
| PHI fail-closed routing (Nango only) | Host |
| Self-hosted render/convert/extract | **This package** (platform modules) |
| Amazon/Katana/Woo first-party clients | **This package** (vendor packs) **or** Composio when OAuth catalog wins |
| Telegram/Slack/iMessage product channels | **This package** (channel packs) + host durable turn / authZ |

Rule of thumb:

- **OAuth + huge multi-app catalog** → Composio/Nango  
- **You own credentials, self-host, or need strict contracts** → platform or vendor lane  
- **Channel is product transport** → channel lane + host outbox/authZ/audit  

---

## Lane A — Platform modules (`src/modules`)

### Pattern

Same as [provider-seam.md](./provider-seam.md):

```text
src/modules/<capability>/
  contracts.ts
  module.ts
  providers/<provider>.ts   # ops type class
  index.ts
```

- Tool ids are **capability-named** (`email-send`, `storage-get-object`).  
- Auth is `{ provider: '…', … }` union.  
- Never name a **platform** module after a single cloud vendor (`cloudflare-email` is forbidden).  
- ofetch services for HTTP; aws4fetch only for SigV4 (S3, Textract, SQS, …).

### Current platform modules

| Module | Providers (today) | Notes |
| --- | --- | --- |
| `email` | cloudflare, resend | Transactional send + batch |
| `storage` | s3, r2 (CF REST), supabase | Object CRUD; R2 S3 API uses `s3` + endpoint |
| `document-extract` | textract | ArtifactRef text extract |
| `file-convert` | transmute | Format conversion (not browser print) |
| `web-fetch` | host allowlist | Free-form allowlisted HTTP |
| `mime` | none | Email message parse/build |
| `media-type` | none | MIME type ↔ extension |

### Planned platform modules

| Module | Job | Provider examples (self-host preferred first) |
| --- | --- | --- |
| `files` | Path-rooted file manage over storage | Nested storage auth + `root_prefix` |
| `document-render` | HTML/URL → PDF / screenshot | **gotenberg**, **browserless**, cloudflare-browser |
| `messaging` | Thin multi-channel *send only* (optional) | telegram, slack, twilio-sms, … as providers |
| `speech` | STT / TTS | whisper-selfhost, elevenlabs, deepgram |
| `vector-store` | Upsert / query / delete vectors | pgvector-http, qdrant, supabase-vector, pinecone |
| `rag` | Ingest + retrieve (uses vector-store + embed auth) | host-bound embed route |
| `pdf` | Merge, split, page count | gotenberg, stirling-pdf, pdf-lib |
| `image` | Resize, thumb, light transforms | imgproxy, sharp (node), cloudinary |
| `browser` | Scrape / structured page ops | browserless, playwright-server |
| `queue` | Enqueue durable work | sqs (aws4fetch), redis, nats |
| `webhook` | Signed outbound HTTP dispatch | pure + ofetch |
| `crypto` | HMAC, JWT verify | pure helpers (`auth: none` or host secrets) |
| `calendar` | ICS build / thin CalDAV | ical pure; CalDAV ofetch |

#### `files` (path-scoped; replaces “org files are only product”)

- Host maps tenant → storage credentials + `root_prefix` (e.g. `orgs/{id}/files/`).  
- Tools: list / search / stat / get / put / delete / copy / mkdir — all under root only.  
- Keys exposed to the model are **relative to root**.  
- Host keeps RLS and org membership; package enforces prefix isolation at the tool boundary.

#### `document-render` vs `file-convert`

| | `file-convert` (Transmute, …) | `document-render` |
| --- | --- | --- |
| Input | Documents / images / formats | HTML string, URL, template |
| Output | Converted file | Print PDF, screenshot PNG |
| Engine | Format converters | Browser / print pipeline |

They share **ArtifactRef + storage**. They are **not** the same module. HTML→PDF via Gotenberg may appear as a render provider or later as a convert provider; screenshots always belong to render.

#### Knowledge / memory (`vector-store`, `rag`)

- `vector-store` — storage ops only; host owns the database.  
- `rag` — chunk/embed/store and retrieve; embed credentials host-bound.  
- Optional thin `mastra-memory` tools only if product needs explicit Mastra memory APIs as agent tools; Mastra Memory ownership stays with the host.  
- Do not reimplement product org-RAG classification policy in this package.

---

## Lane B — Vendor packs (`src/vendors`)

### Why this lane exists

Amazon SP-API, Katana, WooCommerce, etc. are **large, domain-specific APIs**. Forcing them into tiny generic “commerce-orders / commerce-products” modules loses coverage and creates fake abstractions.

Vendor packs are the first-party analogue of a Composio toolkit:

- One pack per vendor.  
- Tool surface grows as APIs are mapped.  
- Auth schema is vendor-specific (still host-bound via `withAuth`).  
- ofetch (or aws4fetch when SigV4 is required) **service clients** own endpoints; tools stay thin.

### Layout

```text
src/vendors/<vendor-key>/
  auth.ts                 # Zod auth (no model fields)
  client.ts               # service client (ofetch / aws4fetch)
  tools/                  # one file per action or domain group
  module.ts               # defineModule({ id: vendor-key, tools: […] })
  index.ts
  README.md               # API map progress, auth setup (host-facing)
```

### Initial vendor targets

| Vendor key | Domains to map (incremental) | Notes |
| --- | --- | --- |
| `woocommerce` | orders, products | REST + consumer key/secret |
| `katana` | sales orders, related reads | Lift from FSS custom client over time |
| `amazon-sp-api` | orders, inventory, reports, documents, … | Large surface; ship action groups deliberately |

Tool ids **may** be vendor-prefixed (`woocommerce-list-orders`, `amazon-sp-api-create-report`). That is intentional for this lane.

### Optional host-level “logical commerce”

Grouping Amazon + Woo under one UI “Orders” catalog is a **host connector/catalog** concern (same idea as Composio logical tools). It is **not** required inside this package. If added later, it is a thin projection over vendor tools, not a replacement for vendor packs.

---

## Lane C — Channels (`src/channels`)

### Product reality

Product messaging is multi-channel (Telegram first; Slack; Photon-backed iMessage; later Teams, WhatsApp). Implementation has been **scattered** (channel OAuth, webhooks, outbox, email tools, operator delivery). This lane consolidates **transport clients + agent tools**; the host keeps durable turns, authZ, and audit.

### Channel pack owns more than webhooks

**Locked:** a channel pack is a **full transport + presentation surface**, not a thin “send message” wrapper.  
If the product channel already does typing, reactions, progressive edit/stream, final/complete, media groups, callbacks, file download, webhook lifecycle, etc., the pack must expose those primitives (client + tools/helpers). Host owns orchestration (when to type, when to react, FIFO cohorts, durable claim) but must not reimplement Bot API / Spectrum / Photon calls.

| Piece | Package (channel) | Host product |
| --- | --- | --- |
| API client (Bot API, Slack Web API, Photon, …) | Yes — **full used surface** | — |
| Outbound tools (send text/media, edit, react, typing, stream write/final, …) | Yes | Allowlist which tools agents get |
| Presentation helpers (e.g. edited-text stream, typing refresher) | Yes (pure/composition over client) | Schedules when to call them |
| Inbound webhook **verification + parse** helpers | Yes | HTTP route registration, raw body |
| Webhook **route**, signature secret storage | Helpers only | Host HTTP + secrets |
| Durable outbox / retries / idempotency / FIFO cohorts | Optional pure helpers | **Host owns** production durability |
| Tenant mapping (chat id → org/agent) | — | **Host** |
| Access level / confirmation / audit / reaction policy | — | **Host** |

So: **every feature the product channel uses for transport/presentation lives in the pack.** Host still owns product orchestration, tenancy, and durability.

### Naming and API design (locked)

Product hosts (including Five Star) are **capability inventories only**. They are **not** the naming authority.

| Rule | Detail |
| --- | --- |
| **No host name inheritance** | Do not copy host symbols, tool ids, helper names, or awkward legacy terms (`sendTelegramMessage`, `createEditedTextStream`, eyes/thinking enums, etc.). |
| **Package-owned names** | Stable, capability-shaped, snake/kebab tool ids (`telegram-send-text`, `telegram-set-reaction`), clean client methods, plain contracts. |
| **Capability ≥ host, often more** | Match every host transport behavior, then open constraints the host hardcoded without product reason (e.g. reactions = **any emoji** + clear, not a four-emoji enum). |
| **Provider limits only** | Cap behavior by the real API (Telegram Bot API, Slack, Photon), not by host policy. Host policy stays in the host. |
| **Thin host adapters later** | Host maps its old names onto this package; the package never mirrors the host. |

### Layout

```text
src/channels/<channel-key>/
  auth.ts
  client.ts               # service client (package-owned method names)
  webhook.ts              # verify + parse → normalized inbound event (pure)
  presentation.ts         # typing refresher, progressive message stream, …
  tools/                  # or tools defined in module.ts
  module.ts
  index.ts
```

### Normalized inbound event (shared shape, channel-specific parser)

Host-facing (and optional tool output), content-minimized:

```ts
{
  channel: 'telegram' | 'slack' | 'imessage' | 'teams' | 'whatsapp'
  event_id: string
  chat_id: string
  user_id?: string
  message_id?: string
  text?: string
  media?: Array<{ kind: string; ref?: string; media_type?: string }>
  reply_to?: string
  raw_type: string          // channel-native type name
  received_at: string       // ISO
}
```

PHI/PII: never log full payloads in package errors; host applies classification.

### Channel targets

| Channel key | Priority | API notes |
| --- | --- | --- |
| `telegram` | P0 (product first) | Bot API |
| `slack` | P1 | Events API + Web API |
| `imessage` | P1 (product specced) | Photon Spectrum |
| `teams` | P2 | Bot Framework / Graph as chosen by host |
| `whatsapp` | P2 | Meta Cloud API or BSP |

### Dual access: pack direct + shared seam (locked)

Both are first-class. Neither replaces the other.

| Path | Import / use | For |
| --- | --- | --- |
| **A. Direct pack** | `@harryy/ai-tools/telegram` (full client, tools, webhook) | Full surface, channel-native ops, agents bound to one channel |
| **B. Shared seam** | `modules/messaging` (or `shared/channel-transport`) over **aligned** client methods | Cross-channel host loops, thin multi-send tools, future adapters |

```text
Host / agent
    │
    ├─► telegramModule / createTelegramClient()     // A: everything
    ├─► slackModule / createSlackClient()
    │
    └─► messagingModule (provider: telegram|slack|…) // B: shared subset only
              │
              └─► same method names on each client
```

Rules:

1. **Packs are source of truth.** Seam never reimplements Bot API / Slack / Photon; it calls pack clients.
2. **Shared subset only.** Seam tools = intersection that is real on every supported channel (send text, edit text when supported, typing/chat-action, set/clear reaction when supported, …). Channel-only ops stay on the pack (`sendMediaGroup`, Slack blocks, Photon containers, …).
3. **Aligned method names (mandatory).** Every channel client implements the shared ops with **identical method names and input shapes** so the seam is wiring, not adapters-per-channel.

### Shared transport method names (package-owned)

These names are the seam contract. Each channel client implements them (or throws `unsupported` only when the provider truly cannot).

| Method | Meaning |
| --- | --- |
| `sendText` | Send plain (or structured-plain) text; optional reply-to |
| `editText` | Edit an existing message’s text |
| `sendChatAction` | Presentation pulse (typing, upload_photo, …); channel maps action → native API |
| `setReaction` | Set reaction emoji(s) on a message; **any emoji** where the API allows |
| `clearReaction` | Clear reactions on a message |
| `sendMedia` | Send one media item (photo/document/file); channel maps kind |
| `downloadFile` | Fetch bytes for a provider file ref |
| `answerCallback` | Acknowledge an interactive callback when the channel has one |

Progressive live text is **not** a seam method; it is a pure helper:

```ts
createLiveMessage({ sendText, editText }) → { start, update, finalize }
```

Same helper works on every client that implements `sendText` + `editText`.

Channel-specific methods use the same style but are **not** on the shared type (`sendMediaGroup`, `setWebhook`, …).

### Optional `messaging` platform module

Thin Lane A module: auth `{ provider: 'telegram' | 'slack' | …, … }`, tools named `messaging-send-text`, `messaging-set-reaction`, etc., dispatching to the pack client’s **shared** methods.  
Not required on day one of Telegram, but **method alignment starts with pack #1** so the seam is free later.

---

## HTTP and transport standards

Applies to all three lanes:

1. **ofetch service clients** for JSON/HTTP (`createServiceFetch`, `serviceRequestJson` / `serviceRequestBytes`).  
2. **aws4fetch** only when SigV4 is required (S3-compatible, Textract, SQS, …).  
3. Prefer **vendor REST** over Workers-only bindings (e.g. R2 REST or S3 API, not `env.R2` as the primary provider).  
4. Auth only via `withAuth` / `ctx.auth`.  
5. Batch + cursor pagination + `rate_limited` / `retryable` where the domain allows.

See [ofetch-services.md](../reference/ofetch-services.md).

---

## Self-hosted provider matrix (preferred defaults)

| Capability | Self-hosted / first-party | Managed optional |
| --- | --- | --- |
| document-render | **Gotenberg**, Browserless, Playwright server | Cloudflare Browser Rendering |
| file-convert | **Transmute**, LibreOffice headless stacks | Cloud convert APIs |
| document-extract | ocrmypdf / tesseract / docling services | **Textract** |
| speech | Whisper / faster-whisper, Piper | ElevenLabs, Deepgram |
| browser | Browserless, Playwright | Firecrawl cloud |
| vector-store | **pgvector**, Qdrant, Weaviate, Chroma | Pinecone, managed Supabase |
| pdf utils | Stirling-PDF, qpdf, pdf-lib | — |
| image | imgproxy, sharp | Cloudinary |
| queue | Redis, NATS | SQS, Cloudflare Queues |

Document each provider’s host setup in module docs (host-facing only; not model-facing tool copy).

---

## Artifact pipeline (cross-cutting)

- Durable bytes use `ArtifactRef` (`store: 'object' | 'host'`).  
- Convert / extract / render / rag-ingest accept ArtifactRef where large payloads must not enter the LLM.  
- `files` and `storage` share the same object plane; `files` only adds root prefix + metadata UX.

---

## Host vs package responsibility (summary)

| Responsibility | Package | Host |
| --- | --- | --- |
| Tool schemas, execute, errors | Yes | — |
| Provider HTTP clients | Yes | — |
| Secret storage / vaults | — | Yes |
| Org tenancy / RLS | — | Yes |
| Agent tool allowlists | — | Yes |
| Channel durable turns / outbox | Helpers optional | Yes |
| Composio/Nango catalog + PHI route | — | Yes |
| Framework projection (Mastra, AI SDK, MCP) | Adapters | Composition |

---

## Build order (locked preference)

1. **Layout** — discover `modules` / `vendors` / `channels`; docs + AGENTS locks (this spec).  
2. **`document-render`** — providers: gotenberg + cloudflare-browser (self-host + current FSS path).  
3. **`files`** — path root over storage (FSS org_files adapter).  
4. **`channels/telegram`** — client + send tools + webhook verify/parse (product P0).  
5. **Vendor lifts** — `woocommerce`, then `katana`, then `amazon-sp-api` (API map incremental).  
6. **`vector-store` + `rag`** — knowledge tools.  
7. **More channels** — slack, imessage, whatsapp, teams as product ships them.  
8. **Remaining platform** — speech, browser, pdf, image, queue, webhook, crypto as needed.

Order may be re-prioritized by product, but layout + render + files/telegram remain the default spine.

---

## Acceptance criteria

- Spec distinguishes **modules / vendors / channels** with explicit layout and import paths.  
- Platform modules keep generic tool ids + provider auth unions.  
- Vendor packs may use vendor-prefixed tool ids and full API surfaces.  
- Channel packs include **tools + webhook verify/parse**, not webhook-only stubs.  
- Document-render is separate from file-convert; self-host providers are first-class.  
- Composio/Nango remain the SaaS OAuth catalog; this package does not absorb them.  
- Host tenancy/authZ/durable turns remain outside package tools.

---

## Implementation notes (non-normative)

- Existing modules under `src/modules/*` already satisfy Lane A for email, storage, extract, convert, web-fetch, mime, media-type.  
- Codegen today discovers `src/modules` only; extend discovery to vendors/channels when the first pack lands.  
- FSS `packages/tools/src/custom/*` can become thin adapters over platform/vendor modules over time without a big-bang rewrite.
