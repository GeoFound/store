export type AuditActorType = "admin" | "customer" | "guest" | "system" | "webhook"

export type WriteAuditLogInput = {
  actorType: AuditActorType
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  riskLevel?: "low" | "medium" | "high"
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export type CreateAfterSaleInput = {
  deliveryId: string
  orderId?: string
  cartId?: string
  paymentAttemptId?: string
  accountItemId?: string
  customerEmail?: string
  reason?: "not_working" | "wrong_item" | "duplicate" | "refund" | "other"
  message: string
  metadata?: Record<string, unknown>
}

export type UpdateAfterSaleInput = {
  id: string
  status?: "open" | "processing" | "resolved" | "rejected" | "closed"
  result?: "pending" | "replaced" | "refunded" | "rejected" | "resolved"
  adminNote?: string
  handledBy?: string
}
