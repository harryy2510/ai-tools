/** Fixed brain packages (not under src/modules). */

export type BrainPackage = {
	/** package.json exports key without leading ./ */
	exportKey: string
	/** tsdown entry key (path under dist without extension) */
	entryKey: string
	/** source entry relative to repo root */
	source: string
}

export const BRAIN_PACKAGES: readonly BrainPackage[] = [
	{ exportKey: 'core', entryKey: 'core/index', source: 'src/core/index.ts' },
	{ exportKey: 'http', entryKey: 'http/index', source: 'src/http/index.ts' },
	{ exportKey: 'mastra', entryKey: 'mastra/index', source: 'src/mastra/index.ts' },
	{ exportKey: 'ai-sdk', entryKey: 'ai-sdk/index', source: 'src/ai-sdk/index.ts' },
	{ exportKey: 'tanstack', entryKey: 'tanstack/index', source: 'src/tanstack/index.ts' },
	{ exportKey: 'cloudflare', entryKey: 'cloudflare/index', source: 'src/cloudflare/index.ts' },
	{ exportKey: 'mcp', entryKey: 'mcp/index', source: 'src/mcp/index.ts' }
]

export const NEVER_BUNDLE = ['@mastra/core', '@modelcontextprotocol/sdk', '@tanstack/ai', 'ai', 'zod'] as const
