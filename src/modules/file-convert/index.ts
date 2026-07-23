/**
 * Public file-convert seam surface.
 * Internals (providers/*) stay private.
 */

export { FileConvertClient } from './client'
export { fileConvertAuthSchema, fileConvertBatchTool, fileConvertModule, fileConvertTool } from './module'
export type { FileConvertAuth } from './module'
export type { ConvertInput, ConvertOutput, FileConvertOps } from './contracts'
export { convertBatchInputSchema, convertBatchOutputSchema, convertInputSchema, convertOutputSchema } from './contracts'
