import { ToolError } from '../../core/errors'

/** Normalize root to a non-absolute prefix that always ends with `/`. */
export function normalizeRootPrefix(rootPrefix: string): string {
	let root = rootPrefix.trim().replaceAll('\\', '/')
	if (root.startsWith('/')) {
		throw new ToolError('root_prefix must not be absolute (no leading /)', { code: 'bad_auth' })
	}
	root = root.replace(/\/+/g, '/')
	if (root.includes('..')) {
		throw new ToolError('root_prefix must not contain ".."', { code: 'bad_auth' })
	}
	if (root.length === 0) {
		throw new ToolError('root_prefix must not be empty', { code: 'bad_auth' })
	}
	if (!root.endsWith('/')) root = `${root}/`
	return root
}

/** Resolve a model-facing relative key under root. Rejects escapes. */
export function resolveUnderRoot(root: string, relativePath: string): string {
	const rel = relativePath.trim().replaceAll('\\', '/').replace(/^\/+/, '')
	if (rel.length === 0) {
		throw new ToolError('Path must not be empty', { code: 'bad_input' })
	}
	if (rel.includes('..') || rel.split('/').includes('..')) {
		throw new ToolError('Path must not contain ".."', { code: 'bad_input' })
	}
	if (rel.startsWith('/') || rel.includes('//')) {
		throw new ToolError('Invalid path', { code: 'bad_input' })
	}
	return `${root}${rel}`
}

/** Prefix for listing (relative folder path, may be empty for root). */
export function resolveListPrefix(root: string, relativePath: string | undefined): string {
	if (!relativePath || !relativePath.trim()) return root
	const rel = relativePath.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
	if (rel.includes('..')) {
		throw new ToolError('Path must not contain ".."', { code: 'bad_input' })
	}
	return `${root}${rel}/`
}

/** Map absolute object key back to relative, or undefined if outside root. */
export function toRelativeKey(root: string, absoluteKey: string): string | undefined {
	if (!absoluteKey.startsWith(root)) return undefined
	return absoluteKey.slice(root.length)
}

export function basename(relativeKey: string): string {
	const parts = relativeKey.replace(/\/+$/, '').split('/')
	const last = parts[parts.length - 1]
	return last ?? relativeKey
}
