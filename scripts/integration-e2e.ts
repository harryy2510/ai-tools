#!/usr/bin/env bun
/**
 * Full local integration e2e (max parallel with Bun):
 *   compose + supabase up (parallel, compose --wait for health)
 *   → write keys into .env (no secret logging)
 *   → bun test --parallel
 *   → compose + supabase down (parallel)
 *
 *   bun run integration:e2e
 */

import { $ } from 'bun'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const envFile = join(root, '.env')
const composeFile = 'docker-compose.integration.yml'
const maxConcurrency = navigator.hardwareConcurrency || 8

process.chdir(root)

function log(msg: string): void {
	console.log(`==> ${msg}`)
}

function die(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

function need(cmd: string): void {
	if (!Bun.which(cmd)) die(`missing required command: ${cmd}`)
}

/** Upsert many KEY=value pairs in .env without logging values. */
function envSetMany(entries: ReadonlyArray<readonly [string, string]>): void {
	const keys = new Set(entries.map(([k]) => k))
	let lines: string[] = []
	if (existsSync(envFile)) {
		lines = readFileSync(envFile, 'utf8')
			.split('\n')
			.filter((line) => {
				if (line === '') return true
				const eq = line.indexOf('=')
				if (eq <= 0) return true
				return !keys.has(line.slice(0, eq))
			})
		while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
	}
	for (const [key, value] of entries) {
		lines.push(`${key}=${value}`)
	}
	writeFileSync(envFile, `${lines.join('\n')}\n`, 'utf8')
}

function parseStatusEnv(raw: string): { apiUrl: string; dbUrl: string; serviceRole: string } {
	const map = new Map<string, string>()
	for (const line of raw.split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
		if (!m?.[1]) continue
		let v = m[2] ?? ''
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1)
		}
		map.set(m[1], v)
	}
	const apiUrl = map.get('API_URL') ?? map.get('SUPABASE_URL') ?? ''
	const dbUrl = map.get('DB_URL') ?? map.get('POSTGRES_URL') ?? map.get('DATABASE_URL') ?? ''
	const serviceRole = map.get('SERVICE_ROLE_KEY') ?? map.get('SECRET_KEY') ?? map.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
	if (!apiUrl) die('could not parse API_URL from supabase status')
	if (!dbUrl) die('could not parse DB_URL from supabase status')
	if (!serviceRole) die('could not parse SERVICE_ROLE_KEY/SECRET_KEY from supabase status')
	return { apiUrl, dbUrl, serviceRole }
}

async function stackUp(): Promise<void> {
	log('up: compose (--wait) + supabase (parallel)')
	const [compose, supabase] = await Promise.all([
		$`docker compose -f ${composeFile} up -d --wait`.nothrow(),
		$`bunx supabase start`.nothrow()
	])
	if (compose.exitCode !== 0) {
		die(`docker compose up failed (exit ${compose.exitCode})`)
	}
	if (supabase.exitCode !== 0) {
		die(`bunx supabase start failed (exit ${supabase.exitCode})`)
	}
}

async function stackDown(): Promise<void> {
	log('down: compose + supabase (parallel)')
	await Promise.allSettled([
		$`docker compose -f ${composeFile} down --remove-orphans`.nothrow().quiet(),
		$`bunx supabase stop`.nothrow().quiet()
	])
}

async function writeEnvFromSupabase(): Promise<void> {
	log('supabase status → .env')
	const status = await $`bunx supabase status -o env`.nothrow().quiet()
	if (status.exitCode !== 0) {
		die('bunx supabase status -o env failed')
	}
	const text = status.stdout.toString()
	if (!text.trim()) die('supabase status -o env produced no output')

	const { apiUrl, dbUrl, serviceRole } = parseStatusEnv(text)

	envSetMany([
		['AI_TOOLS_SUPABASE_URL', apiUrl],
		['AI_TOOLS_SUPABASE_API_KEY', serviceRole],
		['AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY', serviceRole],
		['AI_TOOLS_MASTRA_DB_URL', dbUrl],
		// Compose-local defaults (idempotent)
		['AI_TOOLS_QDRANT_URL', 'http://127.0.0.1:6333'],
		['AI_TOOLS_QDRANT_COLLECTION', 'ai_tools_it'],
		['AI_TOOLS_S3_ACCESS_KEY_ID', 'aitools'],
		['AI_TOOLS_S3_SECRET_ACCESS_KEY', 'aitools-secret'],
		['AI_TOOLS_S3_REGION', 'us-east-1'],
		['AI_TOOLS_S3_BUCKET', 'ai-tools-it'],
		['AI_TOOLS_S3_ENDPOINT', 'http://127.0.0.1:9000'],
		['AI_TOOLS_GOTENBERG_BASE_URL', 'http://127.0.0.1:3000'],
		['AI_TOOLS_SUPABASE_STORAGE_BUCKET', 'ai-tools-it'],
		['AI_TOOLS_SUPABASE_VECTOR_TABLE', 'ai_tools_vectors'],
		['AI_TOOLS_SUPABASE_TABLE', 'ai_tools_vectors'],
		['AI_TOOLS_SUPABASE_MATCH_RPC', 'match_vectors'],
		['AI_TOOLS_SUPABASE_SCHEMA', 'public'],
		['AI_TOOLS_MASTRA_SCHEMA', 'public']
	])

	log('wrote .env (values not printed)')
}

function loadEnvIntoProcess(): void {
	if (!existsSync(envFile)) return
	for (const line of readFileSync(envFile, 'utf8').split('\n')) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const eq = trimmed.indexOf('=')
		if (eq <= 0) continue
		const key = trimmed.slice(0, eq)
		let value = trimmed.slice(eq + 1)
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1)
		}
		process.env[key] = value
	}
}

async function runTests(): Promise<number> {
	log(`test:integration (bun --parallel --max-concurrency=${maxConcurrency})`)
	const result =
		await $`bun test --parallel --max-concurrency=${maxConcurrency} test/integration/vendors test/integration/seams`.nothrow()
	return result.exitCode ?? 1
}

async function main(): Promise<void> {
	need('docker')
	need('bun')

	let exitCode = 0
	try {
		await stackUp()
		await writeEnvFromSupabase()
		loadEnvIntoProcess()
		exitCode = await runTests()
		if (exitCode === 0) log('tests finished OK')
		else log('tests finished with failures')
	} finally {
		await stackDown()
	}
	process.exit(exitCode)
}

await main()
