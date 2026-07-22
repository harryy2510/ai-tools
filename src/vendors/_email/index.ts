/**
 * Email vertical kit for vendor packs only.
 * Not published — directory name `_email` is skipped by surface codegen.
 */

export { addressList, addressObject, addressObjectList, addressToString, recipientCount } from './address'
export { assertEmailSize, assertRecipientLimit } from './limits'
export type { EmailRecipients } from './limits'
export { attachmentSchema, MAX_BATCH_EMAILS, MAX_EMAIL_BYTES, namedAddressSchema } from './schemas'
export type { EmailAttachment, NamedAddress } from './schemas'
