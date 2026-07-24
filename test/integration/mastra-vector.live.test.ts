/**
 * Live Mastra PgVector (@mastra/pg).
 *
 * Env:
 *   AI_TOOLS_MASTRA_DB_URL=postgresql://…@127.0.0.1:54322/postgres
 *   AI_TOOLS_MASTRA_SCHEMA=public   (optional)
 *   AI_TOOLS_ALLOW_REMOTE=1         (optional; allow non-local DB URL)
 *
 * Requires peer `@mastra/pg` and Postgres with pgvector.
 */

import { afterAll, describe, test } from 'bun:test'

import { MastraVectorClient } from '../../src/vendors/mastra-vector'
import { VectorStoreClient } from '../../src/modules/vector-store'
import { assertLocalDbUrl, assertUpsertQueryDeleteRoundTrip, env, sampleVectorA, uniqueId } from './helpers'

const dbUrl = env('AI_TOOLS_MASTRA_DB_URL')
const schemaName = env('AI_TOOLS_MASTRA_SCHEMA')
const run = dbUrl ? describe : describe.skip

run('integration mastra-vector', () => {
	const indexName = uniqueId('ai_tools_mastra').replaceAll('-', '_')
	const clients: MastraVectorClient[] = []

	afterAll(async () => {
		for (const c of clients) {
			await c.disconnect().catch(() => undefined)
		}
	})

	test('vendor client round-trip', async () => {
		if (!dbUrl) return
		assertLocalDbUrl(dbUrl, 'AI_TOOLS_MASTRA_DB_URL')
		const client = new MastraVectorClient({
			connection_string: dbUrl,
			id: `ai-tools-it-${indexName}`,
			default_index: indexName,
			dimension: sampleVectorA.length,
			auto_create_index: true,
			...(schemaName ? { schema_name: schemaName } : {})
		})
		clients.push(client)
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})

	test('vector-store seam provider=mastra', async () => {
		if (!dbUrl) return
		assertLocalDbUrl(dbUrl, 'AI_TOOLS_MASTRA_DB_URL')
		const seamIndex = `${indexName}_seam`
		const client = VectorStoreClient.fromAuth({
			provider: 'mastra',
			connection_string: dbUrl,
			id: `ai-tools-it-seam-${seamIndex}`,
			default_index: seamIndex,
			dimension: sampleVectorA.length,
			auto_create_index: true,
			...(schemaName ? { schema_name: schemaName } : {})
		})
		// Seam client does not expose disconnect; process exit closes pool in short tests.
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})
})
