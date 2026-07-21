import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: {
		'core/index': 'src/core/index.ts',
		'http/index': 'src/http/index.ts',
		'mastra/index': 'src/mastra/index.ts',
		'ai-sdk/index': 'src/ai-sdk/index.ts',
		'tanstack/index': 'src/tanstack/index.ts',
		'cloudflare/index': 'src/cloudflare/index.ts',
		'mcp/index': 'src/mcp/index.ts'
	},
	format: ['esm'],
	// package.json is "type": "module" — emit .js / .d.ts (not .mjs / .d.mts)
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	deps: {
		neverBundle: ['@mastra/core', '@modelcontextprotocol/sdk', '@tanstack/ai', 'ai', 'zod']
	}
})
