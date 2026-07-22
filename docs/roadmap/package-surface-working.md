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
| `email` | Done | cloudflare, resend |
| `storage` | Done | s3 (+ multipart + signed URL), r2 REST, supabase |
| `document-extract` | Done | textract only |
| `file-convert` | Done | transmute only |
| `web-fetch` | Done | allowlisted ofetch |
| `mime` / `media-type` | Done | pure |
| `files` | Done | path root over storage: list/search/stat/get/put/delete/copy/move/mkdir + multipart (S3) |
| `document-render` | Done | gotenberg + cloudflare-browser |
| `vector-store` / `rag` | Not started | knowledge tools |
| `messaging` (thin send) | Not started | optional |
| `speech` / `pdf` / `image` / `browser` / `queue` / `webhook` / `crypto` / `calendar` | Not started | |
| Codegen multi-lane | Done | discovers modules + vendors + channels |
| `vendors/*` | Not started | layout not scaffolded |
| `channels/*` | Not started | layout not scaffolded |

### B. Five Star host — custom tools (`packages/tools/src/custom`)

| Custom key | Actions (summary) | Future home |
| --- | --- | --- |
| `email_sender` | `send_email` | Adapter → `email` module |
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
| Telegram | P0 production | `channels/telegram` |
| Slack | P1 | `channels/slack` |
| iMessage (Photon) | Specced | `channels/imessage` |
| Teams | Later | `channels/teams` |
| WhatsApp | Later | `channels/whatsapp` |
| Email as channel | Delivery + tools | `email` module + host inbound |

Host still owns: webhook HTTP routes, secret storage, chat→org/agent map, durable outbox, accessLevel, audit.

---

## Channel pack checklist (every channel)

Use for Telegram first, then copy the row pattern.

| Work item | Package | Host |
| --- | --- | --- |
| Auth schema (bot token / app creds) | Yes | Vault bind |
| ofetch/aws service client | Yes | — |
| `send-message` / `send-media` tools | Yes | Agent allowlist |
| Edit / react / thread tools (as API allows) | Yes | Allowlist |
| Webhook signature verify | Yes (pure helper) | Call from route |
| Webhook body → normalized inbound event | Yes | Persist / route to agent |
| HTTP route registration | — | Yes |
| Outbox / retries / idempotency | optional helpers | **Yes (production)** |
| Tenant + agent resolution | — | Yes |

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
| 3 | `channels/telegram` | Pending | send tools + webhook verify/parse + tests |
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
2. **messaging vs channels only:** ship thin `messaging` send module, or channels-only until needed?  
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
| 2026-07-22 | document-render ≠ file-convert; self-host first (Gotenberg) |
| 2026-07-22 | org files → path-scoped `files` over storage |
| 2026-07-22 | Composio/Nango remain SaaS OAuth + PHI catalog |

---

## How to update this doc

- After each delivered slice: flip checklist status, note commit/version if released.  
- New product inventory: add rows under Inventory, not new architecture.  
- Architecture change: edit [package-surface-architecture.md](../specs/package-surface-architecture.md) first, then Decision log here.
