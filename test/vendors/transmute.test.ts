import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { transmuteConvertBatchTool, transmuteConvertTool, transmuteModule } from '../../src/vendors/transmute'

describe('transmute', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(transmuteModule).ok).toBe(true)
		expect(transmuteModule.auth.type).toBe('custom')
		expect(transmuteModule.tools.map((t) => t.id).sort()).toEqual(['transmute-convert', 'transmute-convert-batch'])
		expect(transmuteConvertTool.id).toBe('transmute-convert')
		expect(transmuteConvertBatchTool.id).toBe('transmute-convert-batch')
	})
})
