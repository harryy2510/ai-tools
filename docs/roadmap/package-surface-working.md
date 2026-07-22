# Working doc: package surface delivery

Status: **living** (update as slices land)  
Package: `@harryy/ai-tools`  
Architecture source of truth: [package-surface-architecture.md](../specs/package-surface-architecture.md)  
Provider seam (Lane A): [provider-seam.md](../specs/provider-seam.md)  

This is **not** a second architecture lock. It tracks inventory, migration, open questions, and slice checklists. When a decision changes, update the architecture spec first, then this doc.

---

## Doc split

| Doc | Holds | Does not hold |
| --- | --- | --- |
| **Architecture spec** | Locked lanes, ownership, patterns, non-goals | Task board, FSS file paths, API map progress |
| **This working doc** | Inventory, adapters, backlog, questions, status | Competing architecture |

---

## Inventory: what exists where (as of 2026-07-22)

### A. `@harryy/ai-tools` (this package)

| Surface | Status | Notes |
| --- | --- | --- |
| Kernel + adapters | Done | core, ofetch services, Mastra/AI SDK/MCP/… |
| Provider seam | Done | Lane A modules |
| `email` (Lane A multi-provider) | **Removed** | Split to vendor packs |
| `vendors/resend` | Done | full pack (send surface first) |
| `vendors/cloudflare-email` | Done | full pack (send surface first) |
| `storage` | Done | s3 (+ multipart + signed URL), r2 REST, supabase |
| `document-extract` | Done | textract only |
| `file-convert` | Done | transmute only |
| `web-fetch` | Done | allowlisted ofetch |
| `mime` / `media-type` | Done | pure |
| `files` | Done | path root over storage: list/search/stat/get/put/delete/copy/move/mkdir + multipart (S3) |
| `document-render` | Done | gotenberg + cloudflare-browser |
| `vector-store` / `rag` | Not started | knowledge tools |
| thin multi-send messaging seam | Not planned | full messaging packs only |
| `speech` / `pdf` / `image` / `browser` / `queue` / `webhook` / `crypto` / `calendar` | Not started | |
| Codegen multi-lane | Done | discovers modules + vendors + messaging |
| `messaging/telegram` | Done | full pack + live message + webhook helpers |
| `messaging/*` (others) | Not started | slack / imessage / … |

### B. Five Star host — custom tools (`packages/tools/src/custom`)

| Custom key | Actions (summary) | Future home |
| --- | --- | --- |
| `email_sender` | `send_email` | Adapter → `resend` or `cloudflare-email` vendor pack |
| `read_document` / textract | `extract_text` | Adapter → `document-extract` + `files`/storage ArtifactRef |
| `document_renderer` | `render_pdf`, `render_screenshot` | Adapter → `document-render` |
| `organization_files` | `list_items`, `search_items`, `get_item` | Adapter → `files` (root_prefix) |
| `amazon_sp_api` | inventory, orders, reports, … | Lift → `vendors/amazon-sp-api` |
| `katana` | sales-order queries | Lift → `vendors/katana` |
| `woocommerce` | orders/products | Lift → `vendors/woocommerce` |

### C. Five Star host — capabilities (`packages/capabilities`)

Control plane only (stay in host): `whoami`, workflows, runs/artifacts, agents, connection intents, readiness, agent update proposals. **Not** candidates for this package.

### D. Five Star host — connector catalog (Composio / Nango)

Logical tools (Gmail, Sheets, Drive, QBO, Zoom, ads, CRMs, …) stay on the **connector-provider-seam**. Do not reimplement in ai-tools unless a first-party vendor pack is explicitly preferred over Composio for that app.

### E. Five Star host — channels (product, currently scattered)

| Channel | Product role | Package home |
| --- | --- | --- |
| Telegram | P0 production | `messaging/telegram` |
| Slack | P1 | `messaging/slack` |
| iMessage (Photon) | Specced | `messaging/imessage` |
| Teams | Later | `messaging/teams` |
| WhatsApp | Later | `messaging/whatsapp` |
| Email as channel | Delivery + tools | `email` module + host inbound |

Host still owns: webhook HTTP routes, secret storage, chat→org/agent map, durable outbox, accessLevel, audit.

---

## Channel pack checklist (every channel)

Use for Telegram first, then copy the row pattern.

**Locked:**

1. Full transport + presentation surface (not thin send).  
2. Host code is a **capability inventory only** — **do not reuse host naming** (it is legacy/messy). Package owns clean names.  
3. Capability **≥ host**, often **strictly more** (provider limits only). Example: reactions accept **any emoji** (and clear); host policy may still pick 👀/🤔/👍/👎.

| Work item | Package | Host |
| --- | --- | --- |
| Auth schema (bot token / app creds) | Yes | Vault bind |
| Service client covering **all** used API methods | Yes (package method names) | — |
| Send text / media / media group | Yes | Agent allowlist / delivery claim |
| Edit message text (+ markup when used) | Yes | Allowlist / stream cadence |
| Typing / chat action + refresh helper | Yes | When to start/stop/renew |
| Reactions set/clear (**any emoji**, not host enum) | Yes | Which emoji for which lifecycle phase |
| Progressive live message: start / update / finalize | Yes | Model delta wiring + final claim |
| Callback answer, file download, webhook get/set/delete | Yes | Route + vault + lifecycle |
| Webhook signature verify | Yes (pure helper) | Call from route |
| Webhook body → normalized inbound event (+ album hints) | Yes | Persist / route / album settlement |
| HTTP route registration | — | Yes |
| Outbox / retries / idempotency / FIFO cohorts | optional helpers | **Yes (production)** |
| Tenant + agent resolution / authZ / audit | — | Yes |

### Telegram capability map (inventory from host; **names are package-owned**)

Host files are reference only for *what* exists, never for *what to call things*.

| Capability (package-facing) | Host does this today | Package shape (proposed) |
| --- | --- | --- |
| Bot identity | `getMe` | client `getBot` · tool `telegram-get-bot` |
| Webhook lifecycle | get/set/delete webhook | client only (or admin tools); host UI |
| Send text | send + reply + markup | `telegram-send-text` |
| Edit text | edit (+ markup) | `telegram-edit-text` |
| Send photo / document / media group | yes | `telegram-send-photo`, `telegram-send-document`, `telegram-send-media-group` |
| Download file bytes | getFile + download | client `downloadFile` · tool `telegram-download-file` |
| Answer callback | yes | `telegram-answer-callback` |
| Chat action / typing | typing only | `telegram-send-chat-action` (full Bot API actions, not typing-only) + `createTypingPulse` helper |
| Message reaction | fixed `👀\|🤔\|👍\|👎\|null` | `telegram-set-reaction` with **any emoji string** or clear |
| Progressive outbound text | `createEditedTextStream` start/write/finish | `createLiveMessage` (`start` / `update` / `finalize`) over send+edit |
| Lifecycle presentation | host picks eyes→thinking→like/dislike | host policy; pack only sets emoji it is given |
| Typing renew | host loop | host schedules; pack supplies action + optional pulse helper |
| Album by media group | durable host | parse/normalize in pack; settlement host |
| Webhook verify + Update parse | host route | pure verify/parse in pack |
| Tenant / grants / FIFO / send claim | host | **host only** |

**Naming anti-patterns (do not ship):** `sendTelegramMessage`, `setTelegramMessageReaction`, `createEditedTextStream`, host-only emoji unions, `AcceptedTurn*`, `permanentOperation`, FSS RPC names.

Slice 3 done when: this capability map is implemented under `src/channels/telegram` with **package names**, tests, docs; host can thin-adapt without reimplementing Bot API.

---

## Vendor pack checklist (every vendor)

| Work item | Notes |
| --- | --- |
| Auth schema + host docs | No model-facing secrets |
| Service client | ofetch or SigV4 as needed |
| API map doc in vendor README | What is mapped / not mapped |
| Ship first action group | e.g. Woo: list/get order + list/get product |
| Expand by demand | Amazon reports, etc. |
| FSS custom thin adapter | Or replace custom module when ready |

### Initial vendor API map stubs

**woocommerce** (start)

- [ ] list/get orders  
- [ ] list/get products  
- [ ] (later) customers, coupons, webhooks admin  

**katana** (start)

- [ ] query sales orders (parity with FSS custom)  
- [ ] (later) related manufacturing reads as needed  

**amazon-sp-api** (start small, map deliberately)

- [ ] orders search/get  
- [ ] FBA inventory summaries  
- [ ] reports create/list/get + document  
- [ ] settlements summary (if product needs)  
- [ ] Do **not** block on full SP-API coverage  

---

## Platform module slice checklist

### Spine (default build order)

| # | Slice | Status | Done when |
| --- | --- | --- | --- |
| 0 | Multi-lane codegen (`modules` + `vendors` + `channels`) | Done | `bun run codegen` registers all three |
| 1 | `document-render` + gotenberg + cloudflare-browser | Done | PDF + screenshot; ArtifactRef out; tests |
| 2 | `files` (root_prefix + storage auth) | Done | list/search/stat relative keys; tests |
| 3 | `messaging/telegram` | Done | Full pack; tools + live message + webhook helpers |
| 3b | `vendors/resend` + `vendors/cloudflare-email` | Done | Lane B email ESPs (no multi-provider email seam) |
| 4 | `vendors/woocommerce` (first action group) | Pending | orders + products read path |
| 5 | `vendors/katana` | Pending | sales order query parity |
| 6 | `vendors/amazon-sp-api` (first action group) | Pending | documented subset live |
| 7 | `vector-store` + `rag` | Pending | upsert/query + ingest/retrieve |
| 8 | `channels/slack` | Pending | same checklist as Telegram |
| 9 | `channels/imessage` (Photon) | Pending | aligned with host imessage spec |
| 10 | Remaining platform (speech, browser, pdf, image, queue, webhook, crypto, calendar, messaging) | Backlog | product-driven |

### FSS adapter work (host repo — track here for visibility)

| Adapter | Depends on | Status |
| --- | --- | --- |
| email_sender → `email` | Done in package | Pending host |
| document_renderer → `document-render` | Slice 1 | Pending |
| organization_files → `files` | Slice 2 | Pending |
| read_document → extract + files/storage | Slice 2 + extract | Pending |
| custom commerce → vendor packs | Slices 4–6 | Pending |

---

## Knowledge / Mastra memory (detail)

| Piece | Package | Host |
| --- | --- | --- |
| `vector-store` tools | Yes | DB connection, collection names |
| `rag-ingest` / `rag-retrieve` | Yes | Embed model route, classification |
| Mastra Memory schemas / PG tables | — | Yes (`@mastra/memory`, operator) |
| Optional `mastra-memory` tool wrapper | Only if product needs tool-facing memory APIs | Binds existing store |
| Org RAG purpose / PHI gates | — | Yes |

---

## Open questions

Record answers here; promote locked answers into the architecture spec.

1. **Codegen:** one manifest for all lanes, or separate manifests? (Default: one discovery root list.)  
2. ~~**messaging vs channels only**~~ → **Locked:** both. Full packs (A) + thin shared seam (B). Shared client method names (`sendText`, `editText`, `sendChatAction`, `setReaction`, `clearReaction`, `sendMedia`, `downloadFile`, `answerCallback`) so seam is wiring. Ship Telegram pack first with those names; `messaging` module can follow once 2+ packs exist.
3. **Amazon auth model:** host always supplies LWA tokens, or package documents refresh helpers?  
4. **document-render ArtifactRef:** always write PDF/PNG to storage, or allow base64 for tiny screenshots? (Default: storage for anything agent-facing in FSS.)  
5. **iMessage:** Photon as only provider under `channels/imessage`?  
6. **SMS:** under `messaging` providers (Twilio) vs separate `sms` module? (Default: `messaging` providers.)  

---

## Decision log (short)

| Date | Decision |
| --- | --- |
| 2026-07-22 | Three lanes: modules / vendors / channels |
| 2026-07-22 | Fat APIs are vendor packs, not forced commerce facades |
| 2026-07-22 | Channels include tools + webhook tooling; host owns durability |
| 2026-07-22 | Channel packs = full transport/presentation surface (typing, reactions, stream edit/final, media groups, …), not thin send |
| 2026-07-22 | Channel naming is package-owned; host is capability inventory only; reactions any emoji (not host enum); capability ≥ host |
| 2026-07-22 | Channels dual access: A full packs + B thin shared seam; aligned client method names for seam wiring |
| 2026-07-22 | document-render ≠ file-convert; self-host first (Gotenberg) |
| 2026-07-22 | org files → path-scoped `files` over storage |
| 2026-07-22 | Composio/Nango remain SaaS OAuth + PHI catalog |

---

## How to update this doc

- After each delivered slice: flip checklist status, note commit/version if released.  
- New product inventory: add rows under Inventory, not new architecture.  
- Architecture change: edit [package-surface-architecture.md](../specs/package-surface-architecture.md) first, then Decision log here.
