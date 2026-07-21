import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { isNil, isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'
import { parseSync } from 'oxc-parser'

export type DiscoveredModule = {
	/** Folder name under src/modules; package export key */
	key: string
	/** Absolute path to public entry (index.ts) */
	entryPath: string
	/** Relative from repo root */
	entryRelative: string
	/** Relative source for tsdown: modules/<key>/index */
	entryKey: string
	/** Named export bindings found on index.ts */
	exportNames: string[]
	/**
	 * Kernel module id extracted via AST from defineModule/defineHttpApi if present
	 * in index.ts or module.ts.
	 */
	moduleId?: string
	/** Source file where moduleId was found */
	moduleIdSource?: string
}

const DEFINE_CALLEES = new Set(['defineModule', 'defineHttpApi'])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return isPlainObject(value)
}

function nodeType(node: unknown): string | undefined {
	if (!isRecord(node)) return undefined
	const t = node['type']
	return isString(t) ? t : undefined
}

function identifierName(node: unknown): string | undefined {
	if (!isRecord(node) || nodeType(node) !== 'Identifier') return undefined
	const name = node['name']
	return isString(name) ? name : undefined
}

function literalString(node: unknown): string | undefined {
	if (!isRecord(node) || nodeType(node) !== 'Literal') return undefined
	const value = node['value']
	return isString(value) ? value : undefined
}

function collectExportNames(programBody: unknown[]): string[] {
	const names = new Set<string>()

	for (const stmt of programBody) {
		const t = nodeType(stmt)
		if (!isRecord(stmt)) continue

		if (t === 'ExportNamedDeclaration') {
			const declaration = stmt['declaration']
			if (isRecord(declaration) && nodeType(declaration) === 'VariableDeclaration') {
				const decls = declaration['declarations']
				if (isArray(decls)) {
					for (const d of decls) {
						if (!isRecord(d)) continue
						const name = identifierName(d['id'])
						if (!isNil(name)) names.add(name)
					}
				}
			}
			const specifiers = stmt['specifiers']
			if (isArray(specifiers)) {
				for (const spec of specifiers) {
					if (!isRecord(spec)) continue
					const name = identifierName(spec['exported'])
					if (!isNil(name)) names.add(name)
				}
			}
		}

		if (t === 'ExportAllDeclaration') {
			names.add('*')
		}

		if (t === 'ExportDefaultDeclaration') {
			names.add('default')
		}
	}

	return [...names].sort()
}

function extractStringProp(objectExpr: UnknownRecord, propName: string): string | undefined {
	const properties = objectExpr['properties']
	if (!isArray(properties)) return undefined
	for (const prop of properties) {
		if (!isRecord(prop) || nodeType(prop) !== 'Property') continue
		const key = prop['key']
		const keyName = identifierName(key) ?? literalString(key)
		if (keyName !== propName) continue
		return literalString(prop['value'])
	}
	return undefined
}

function findDefineModuleId(programBody: unknown[]): string | undefined {
	for (const stmt of programBody) {
		if (!isRecord(stmt)) continue
		const t = nodeType(stmt)

		if (t === 'ExportNamedDeclaration' || t === 'VariableDeclaration') {
			const declaration = t === 'ExportNamedDeclaration' ? stmt['declaration'] : stmt
			if (!isRecord(declaration) || nodeType(declaration) !== 'VariableDeclaration') continue
			const decls = declaration['declarations']
			if (!isArray(decls)) continue
			for (const d of decls) {
				if (!isRecord(d)) continue
				const id = extractIdFromDefineCall(d['init'])
				if (!isNil(id)) return id
			}
		}

		if (t === 'VariableDeclaration') {
			const decls = stmt['declarations']
			if (!isArray(decls)) continue
			for (const d of decls) {
				if (!isRecord(d)) continue
				const id = extractIdFromDefineCall(d['init'])
				if (!isNil(id)) return id
			}
		}
	}
	return undefined
}

function extractIdFromDefineCall(init: unknown): string | undefined {
	if (!isRecord(init) || nodeType(init) !== 'CallExpression') return undefined
	const calleeName = identifierName(init['callee'])
	if (isNil(calleeName) || !DEFINE_CALLEES.has(calleeName)) return undefined
	const args = init['arguments']
	if (!isArray(args) || args.length === 0) return undefined
	const first = args[0]
	if (!isRecord(first) || nodeType(first) !== 'ObjectExpression') return undefined
	return extractStringProp(first, 'id')
}

function parseTs(filePath: string, source: string): { body: unknown[]; errors: unknown[] } {
	const result = parseSync(filePath, source, {
		sourceType: 'module',
		lang: 'ts'
	})
	const body = result.program.body
	return {
		body: isArray(body) ? body : [],
		errors: isArray(result.errors) ? result.errors : []
	}
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * Discover product modules under src/modules/<key>/index.ts using oxc-parser (Rust).
 */
export async function discoverModules(repoRoot: string): Promise<DiscoveredModule[]> {
	const modulesRoot = path.join(repoRoot, 'src/modules')
	let entries: string[]
	try {
		entries = await readdir(modulesRoot)
	} catch {
		return []
	}

	const discovered: DiscoveredModule[] = []

	for (const key of entries.sort()) {
		if (key.startsWith('.')) continue
		const dir = path.join(modulesRoot, key)
		const st = await stat(dir)
		if (!st.isDirectory()) continue

		if (!KEBAB.test(key)) {
			throw new Error(`Module folder must be kebab-case: src/modules/${key}`)
		}

		const entryPath = path.join(dir, 'index.ts')
		let entrySource: string
		try {
			entrySource = await readFile(entryPath, 'utf8')
		} catch {
			throw new Error(`Module src/modules/${key} must have index.ts`)
		}

		const parsed = parseTs(entryPath, entrySource)
		if (parsed.errors.length > 0) {
			const msg = parsed.errors
				.map((e) => {
					if (isRecord(e) && isString(e['message'])) return e['message']
					return String(e)
				})
				.join('; ')
			throw new Error(`oxc-parser failed on src/modules/${key}/index.ts: ${msg}`)
		}

		const exportNames = collectExportNames(parsed.body)
		if (exportNames.length === 0) {
			throw new Error(`src/modules/${key}/index.ts must export at least one binding`)
		}

		let moduleId = findDefineModuleId(parsed.body)
		let moduleIdSource: string | undefined = moduleId ? entryPath : undefined

		if (!moduleId) {
			const modulePath = path.join(dir, 'module.ts')
			try {
				const moduleSource = await readFile(modulePath, 'utf8')
				const moduleParsed = parseTs(modulePath, moduleSource)
				if (moduleParsed.errors.length === 0) {
					moduleId = findDefineModuleId(moduleParsed.body)
					if (moduleId) moduleIdSource = modulePath
				}
			} catch {
				// module.ts optional
			}
		}

		discovered.push({
			key,
			entryPath,
			entryRelative: path.relative(repoRoot, entryPath).split(path.sep).join('/'),
			entryKey: `modules/${key}/index`,
			exportNames,
			...(isNil(moduleId) ? {} : { moduleId }),
			...(isNil(moduleIdSource)
				? {}
				: { moduleIdSource: path.relative(repoRoot, moduleIdSource).split(path.sep).join('/') })
		})
	}

	return discovered
}
