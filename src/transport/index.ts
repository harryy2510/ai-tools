/**
 * Public transport (`@harryy/ai-tools/http`).
 * Inside the package prefer leaf imports: `./http-service`, `./aws-service`.
 */

export { AwsService } from './aws-service'
export type { AwsCredentials, AwsServiceOptions, AwsCallOptions, AwsQueryResult, AwsBytesResult } from './aws-service'
export {
	assertHttpStatusOk,
	httpErrorCode,
	mapTransportNetworkError,
	retryAfterMsFromHeader,
	throwHttpStatus
} from './errors'
export type { StatusThrowOptions } from './errors'
export { HttpService } from './http-service'
export type { HttpBody, HttpBytesResult, HttpCallOptions, HttpQueryResult, HttpServiceOptions } from './http-service'
