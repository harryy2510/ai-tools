import { describe, expect, test } from 'bun:test'

import { createAiSdkTools } from '../src/ai-sdk'
import { createCloudflareAiTools } from '../src/cloudflare'
import { runTool } from '../src/core'
import { createMcpTools, registerMcpTools } from '../src/mcp'
import { createMastraTools } from '../src/mastra'
import { createTanStackTools } from '../src/tanstack'
import { echoModule, echoTool } from './fixtures/echo-module'

describe('adapters', () => {
	test('mastra keys by tool id', () => {
		const tools = createMastraTools(echoModule)
		expect(Object.keys(tools)).toEqual(['echo-message'])
		expect(tools['echo-message']?.id).toBe('echo-message')
		expect(tools['echo-message']?.description).toBe(echoTool.description)
	})

	test('ai-sdk keys by tool id and has execute', () => {
		const tools = createAiSdkTools(echoModule)
		const t = tools['echo-message']
		expect(t).toBeDefined()
		expect(t?.description).toBe(echoTool.description)
		expect(typeof t?.execute).toBe('function')
	})

	test('tanstack uses id as name and executes via server tool', async () => {
		const tools = createTanStackTools(echoModule)
		expect(tools).toHaveLength(1)
		const t = tools[0]
		if (!t) throw new Error('expected tool')
		expect(t.name).toBe('echo-message')
		expect(t.description).toBe(echoTool.description)
		if (!t.execute) throw new Error('expected execute')
		const result = await t.execute({ message: 'yo' })
		expect(result).toEqual({ message: 'yo' })
	})

	test('cloudflare emits parameters json schema and executors', async () => {
		const set = createCloudflareAiTools(echoModule)
		expect(set.definitions).toHaveLength(1)
		const def = set.definitions[0]
		if (!def) throw new Error('expected definition')
		expect(def.name).toBe('echo-message')
		expect(def.parameters['type']).toBe('object')
		const result = await set.execute('echo-message', { message: 'cf' })
		expect(result).toEqual({ message: 'cf' })
	})

	test('mcp list + call wrap results as CallToolResult-shaped payloads', async () => {
		const set = createMcpTools(echoModule)
		expect(set.list).toHaveLength(1)
		const item = set.list[0]
		if (!item) throw new Error('expected list item')
		expect(item.name).toBe('echo-message')
		expect(item.inputSchema['type']).toBe('object')
		expect(item.annotations?.readOnlyHint).toBe(true)

		const result = await set.call('echo-message', { message: 'mcp' })
		expect(result.isError).toBeUndefined()
		expect(result.content[0]?.type).toBe('text')
		expect(result.structuredContent).toEqual({ message: 'mcp' })
	})

	test('mcp call returns isError for unknown tools', async () => {
		const set = createMcpTools(echoModule)
		const result = await set.call('nope', {})
		expect(result.isError).toBe(true)
	})

	test('registerMcpTools registers each tool on a server-like host', () => {
		const registered: string[] = []
		const server = {
			registerTool: (name: string) => {
				registered.push(name)
				return {}
			}
		}
		registerMcpTools(server, echoModule)
		expect(registered).toEqual(['echo-message'])
	})

	test('kernel runTool still works for direct calls', () => {
		expect(runTool(echoTool, { message: 'direct' })).resolves.toEqual({ message: 'direct' })
	})
})
