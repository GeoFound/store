import type { ManualPaymentInstructions } from "../types"

export type CreateProviderPaymentInput = {
  cartId: string
  amount: number
  currency: string
  paymentMethod: string
  customerEmail?: string
  metadata?: Record<string, unknown>
  channelConfig?: Record<string, unknown> | null
}

export type CreateProviderPaymentResult = {
  providerOrderId: string
  paymentUrl?: string | null
  qrCodeUrl?: string | null
  expiresAt?: Date | null
  responsePayload?: Record<string, unknown> | null
  instructions?: ManualPaymentInstructions
}

export type PaymentWebhookResult = {
  providerOrderId: string
  status: "paid" | "failed" | "expired"
  payload: Record<string, unknown>
}

export type PaymentWebhookContext = {
  headers?: Record<string, string | string[] | undefined>
  rawBody?: Buffer | string
}

export type PaymentQueryResult = {
  providerOrderId: string
  status: "pending" | "paid" | "failed" | "expired"
  payload?: Record<string, unknown>
}

export interface PaymentProvider {
  code: string
  createPayment(
    input: CreateProviderPaymentInput
  ): Promise<CreateProviderPaymentResult> | CreateProviderPaymentResult
  parseWebhook?(
    payload: Record<string, unknown>,
    context?: PaymentWebhookContext
  ): PaymentWebhookResult
  queryPayment?(providerOrderId: string): Promise<PaymentQueryResult>
}
