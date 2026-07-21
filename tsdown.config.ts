import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: {
		'core/index': 'src/core/index.ts',
		'http/index': 'src/http/index.ts',
		'mastra/index': 'src/mastra/index.ts',
		'modules/weather/index': 'src/modules/weather/index.ts'
	},
	format: ['esm'],
	// package.json is "type": "module" — emit .js / .d.ts (not .mjs / .d.mts)
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	// @mastra/core is an optional peer; zod is the only runtime dependency.
	deps: {
		neverBundle: ['@mastra/core', 'zod']
	}
})
