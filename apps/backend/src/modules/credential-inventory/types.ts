export type AccountItemStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "locked"
  | "refunded"

export type ImportCredentialInput = {
  credential: Record<string, unknown> | string
  accountIdentifier?: string
  displayLabel?: string
  sourceNote?: string
  costPrice?: number
  currency?: string
  metadata?: Record<string, unknown>
}

export type CreateCredentialBatchInput = {
  name: string
  productVariantId: string
  sourceNote?: string
  costPrice?: number
  currency?: string
  metadata?: Record<string, unknown>
  items: ImportCredentialInput[]
}

export type ReserveCredentialInput = {
  productVariantId: string
  quantity: number
  reservationKey: string
  cartId?: string
  orderId?: string
  ttlSeconds?: number
}
