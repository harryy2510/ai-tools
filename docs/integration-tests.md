# Live integration tests — every vendor + every seam

## Local stack: Docker compose + Supabase CLI

### Ports (Supabase non-default)

| Service | Port | Notes |
| --- | --- | --- |
| Supabase API | **60121** | (default 54321) |
| Supabase DB | **60122** | (default 54322) |
| Supabase Studio | **60123** | (default 54323) |
| Inbucket | **60124** | |
| Analytics | **60127** | |
| Qdrant | 6333 | compose |
| MinIO S3 | 9000 / UI 9001 | compose |
| Gotenberg | 3000 | compose |

### One-shot e2e (recommended)

```bash
cd /Users/harryy/Desktop/hariom/ai-tools
# needs: Docker + bun on PATH (supabase via bunx)
bun run integration:e2e
```

`scripts/integration-e2e.ts` (Bun) runs in parallel where possible:

1. **parallel up:** `docker compose up -d --wait` + `bunx supabase start` (`Promise.all`)
2. `bunx supabase status -o env` → single-write API URL, DB URL, service_role into `.env` (no secrets printed)
3. **parallel tests:** `bun test --parallel --max-concurrency=<cpu>`
4. **parallel down:** compose + `bunx supabase stop` (always, even on failure)

Manual parallel helpers:

```bash
bun run integration:up      # compose + supabase in parallel
bun run integration:down    # both in parallel
```

### Manual start / stop

```bash
bun run integration:up
bunx supabase status   # if you need keys yourself
set -a && source .env && set +a
bun run test:integration
bun run integration:down
```

`.env` holds all `AI_TOOLS_*` vars (gitignored). Do not commit it. Agents must not read `.env`.

Migrations under `supabase/migrations/` create `ai_tools_vectors`, `match_vectors`, and storage bucket `ai-tools-it`.

### What is local vs cloud

**Local (compose + supabase):** qdrant, minio/s3, gotenberg, supabase storage/vector, mastra-vector (same Postgres).

**Cloud / external keys still needed:** Resend, CF email/browser, Telegram, Slack, Teams, iMessage proxy, Pinecone, Woo, Katana, Amazon, Transmute, Textract, embed models.

---

## Commands

```bash
bun test                    # unit only
bun run test:integration    # live (skips missing env)
bun test test/integration/vendors/resend.live.test.ts
```

---

## Vendors (one live file each)

| Vendor | Env (prefix `AI_TOOLS_`) | Smoke |
| --- | --- | --- |
| resend | `RESEND_API_KEY`, `FROM`, `TO` | send |
| cloudflare-email | `CF_EMAIL_*` | send |
| telegram | `TELEGRAM_BOT_TOKEN` (+ chat) | getBot / send |
| slack | `SLACK_BOT_TOKEN` (+ channel) | getBot / send |
| teams | `TEAMS_APP_ID`, `APP_PASSWORD` | getBot |
| imessage | proxy URL + project + chat | sendText |
| s3 | `S3_*` (MinIO defaults in `.env`) | put/get/delete |
| r2 | `R2_*` | put/get/delete |
| supabase-storage | `SUPABASE_URL`, service role, bucket | put/get/delete |
| gotenberg | `GOTENBERG_BASE_URL` + S3 | renderPdf |
| cloudflare-browser | CF browser token + S3 | renderPdf |
| transmute | base URL + token + S3 | convert |
| textract | AWS + `TEXTRACT_SOURCE_KEY` | extractText |
| woocommerce / katana / amazon-sp-api | store/API keys | list* |
| qdrant | `QDRANT_URL` | vector CRUD |
| pinecone | API key + base URL | vector CRUD |
| supabase-vector | Supabase URL + service role | vector CRUD |
| mastra-vector | `MASTRA_DB_URL` (local Supabase DB) | vector CRUD |

## Seams

| Seam | Env | Smoke |
| --- | --- | --- |
| content-type, mime, email-message | none | pure |
| web-fetch | network | GET example.com |
| email | Resend | send |
| storage / files | S3/MinIO | put/get/delete |
| messaging | Telegram | send |
| document-render | Gotenberg + S3 | renderPdf |
| file-convert | Transmute + S3 | convert |
| document-extract | Textract | extractText |
| vector-store | any vector backend | provider matrix |
| rag | embed + vector backend | ingest/retrieve |

---

## After `bunx supabase start`

```bash
bunx supabase status -o env
# map:
# API_URL        → AI_TOOLS_SUPABASE_URL=http://127.0.0.1:60121
# DB_URL         → AI_TOOLS_MASTRA_DB_URL=...
# SERVICE_ROLE_KEY → AI_TOOLS_SUPABASE_API_KEY and AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY
```

If DB password differs from `postgres`, update `AI_TOOLS_MASTRA_DB_URL` only (do not ask agents to open `.env`).
