import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { discoverModules } from '../scripts/codegen/discover'
import { renderPackageExports, renderTsdownConfig } from '../scripts/codegen/render'

describe('codegen discover (oxc-parser)', () => {
	test('discovers modules and extracts defineModule id from AST', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ai-tools-codegen-'))
		try {
			const modDir = path.join(root, 'src/modules/demo-echo')
			await mkdir(modDir, { recursive: true })
			await writeFile(path.join(modDir, 'index.ts'), `export { demoEchoModule } from './module'\n`)
			await writeFile(
				path.join(modDir, 'module.ts'),
				`import { defineModule, defineTool } from '../../core'
import { z } from 'zod'

const tool = defineTool({
  id: 'demo-ping',
  name: 'ping',
  description: 'Ping for codegen discovery tests.',
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async () => ({ ok: true }),
})

export const demoEchoModule = defineModule({
  id: 'demo-echo',
  title: 'Demo',
  description: 'Demo module for codegen.',
  tools: [tool],
})
`
			)

			const modules = await discoverModules(root)
			expect(modules).toHaveLength(1)
			const mod = modules[0]
			if (!mod) throw new Error('expected module')
			expect(mod.key).toBe('demo-echo')
			expect(mod.exportNames).toContain('demoEchoModule')
			expect(mod.moduleId).toBe('demo-echo')
			expect(mod.entryKey).toBe('modules/demo-echo/index')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('rejects module folders that are not kebab-case', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ai-tools-codegen-bad-'))
		try {
			const modDir = path.join(root, 'src/modules/NotGood')
			await mkdir(modDir, { recursive: true })
			await writeFile(path.join(modDir, 'index.ts'), `export const x = 1\n`)
			expect(discoverModules(root)).rejects.toThrow(/kebab-case/)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('render merges brain exports with modules', () => {
		const exports = renderPackageExports([
			{
				key: 'demo-echo',
				entryPath: '/x',
				entryRelative: 'src/modules/demo-echo/index.ts',
				entryKey: 'modules/demo-echo/index',
				exportNames: ['demoEchoModule']
			}
		])
		expect(exports['./core']).toBeDefined()
		expect(exports['./mcp']).toBeDefined()
		expect(exports['./demo-echo']).toEqual({
			types: './dist/modules/demo-echo/index.d.ts',
			default: './dist/modules/demo-echo/index.js'
		})

		const tsdown = renderTsdownConfig([
			{
				key: 'demo-echo',
				entryPath: '/x',
				entryRelative: 'src/modules/demo-echo/index.ts',
				entryKey: 'modules/demo-echo/index',
				exportNames: ['demoEchoModule']
			}
		])
		expect(tsdown).toContain("'modules/demo-echo/index': 'src/modules/demo-echo/index.ts'")
		expect(tsdown).toContain('AUTO-GENERATED')
	})
})

describe('repo codegen artifacts', () => {
	test('module-manifest exists and lists brain packages', async () => {
		const manifestPath = path.join(import.meta.dir, '../generated/module-manifest.json')
		const raw = await readFile(manifestPath, 'utf8')
		const manifest = JSON.parse(raw) as {
			brain: Array<{ exportKey: string }>
			modules: unknown[]
		}
		expect(manifest.brain.map((b) => b.exportKey)).toContain('core')
		expect(manifest.brain.map((b) => b.exportKey)).toContain('mcp')
		expect(Array.isArray(manifest.modules)).toBe(true)
	})
})
