import crypto from "crypto"
import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProvider,
  PaymentWebhookContext,
  PaymentWebhookResult,
} from "./types"
import { assertManualWebhookSignature } from "./manual-webhook-signature"

export class ManualPaymentProvider implements PaymentProvider {
  code = "manual"

  createPayment(
    _input: CreateProviderPaymentInput
  ): CreateProviderPaymentResult {
    const providerOrderId = `manual_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`
    const publicReference = `pay_${crypto.randomBytes(6).toString("hex")}`

    return {
      providerOrderId,
      paymentUrl: null,
      qrCodeUrl: null,
      expiresAt: null,
      responsePayload: {
        public_reference: publicReference,
      },
      instructions: {
        title: "Manual payment pending",
        body:
          "Send payment using the agreed manual channel, then contact support with this reference. The order will be delivered after confirmation.",
        reference: publicReference,
      },
    }
  }

  parseWebhook(
    payload: Record<string, unknown>,
    context?: PaymentWebhookContext
  ): PaymentWebhookResult {
    assertManualWebhookSignature(payload, context)

    if (payload.status !== "paid") {
      throw new Error("Only paid status is supported by manual webhook")
    }

    if (typeof payload.provider_order_id !== "string") {
      throw new Error("provider_order_id is required")
    }

    return {
      providerOrderId: payload.provider_order_id,
      status: "paid",
      payload,
    }
  }
}

export const manualPaymentProvider = new ManualPaymentProvider()
