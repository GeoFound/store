export type PaymentMethodCode = string

export type CreatePaymentAttemptInput = {
  cartId: string
  amount: number
  currency: string
  paymentMethod: PaymentMethodCode
  customerEmail?: string
  metadata?: Record<string, unknown>
}

export type ManualPaymentInstructions = {
  title: string
  body: string
  reference: string
}
