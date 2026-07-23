/**
 * Public web-fetch surface.
 * Internals (domain helpers) stay private.
 */

export { WebFetchClient } from './client'
export { webFetchAuthSchema, webFetchGetTool, webFetchModule, webFetchRequestTool } from './module'
export type { WebFetchAuth } from './module'
export type { WebFetchGetInput, WebFetchRequestInput, WebFetchRequestOutput } from './contracts'
