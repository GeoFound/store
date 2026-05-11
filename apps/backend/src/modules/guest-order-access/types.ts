export type OrderAccessPurpose = "view_order" | "claim_order"

export type IssueOrderAccessTokenInput = {
  orderId: string
  customerEmail: string
  purpose?: OrderAccessPurpose
  expiresAt?: Date | null
  metadata?: Record<string, unknown> | null
}

export type VerifyRecoveryCodeInput = {
  orderId: string
  customerEmail: string
  code: string
}
