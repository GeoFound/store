import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import PaymentAttempt from "./models/payment-attempt"
import PaymentChannel from "./models/payment-channel"
import type {
  CreatePaymentAttemptInput,
  PaymentMethodCode,
} from "./types"
import {
  getPaymentProvider,
  hasPaymentProvider,
} from "./providers/registry"

class PaymentRouterModuleService extends MedusaService({
  PaymentChannel,
  PaymentAttempt,
}) {
  async ensureDefaultChannels() {
    const existing = await this.listPaymentChannels({
      code: "manual",
    })

    if (existing.length) {
      return
    }

    try {
      await this.createPaymentChannels({
        code: "manual",
        name: "Manual Payment",
        display_name: "Manual payment",
        type: "manual",
        enabled: true,
        priority: 100,
        provider_code: "manual",
        health_status: "healthy",
        config_json: {
          instructions:
            "Submit the order, then contact support with the payment reference.",
        },
      })
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return
      }

      throw error
    }
  }

  async listAvailablePaymentChannels(input?: {
    amount?: number
    currency?: string
  }) {
    await this.ensureDefaultChannels()
    const currency = normalizeCurrencyCode(input?.currency)

    const channels = await this.listPaymentChannels(
      {
        enabled: true,
      },
      {
        order: {
          priority: "ASC",
        },
      },
    )

    return channels.filter((channel) => {
      if (!hasPaymentProvider(channel.provider_code)) {
        return false
      }

      if (channel.health_status === "down") {
        return false
      }

      const channelCurrency = normalizeCurrencyCode(channel.currency)

      if (currency && channelCurrency && channelCurrency !== currency) {
        return false
      }

      if (
        typeof input?.amount === "number" &&
        typeof channel.min_amount === "number" &&
        input.amount < channel.min_amount
      ) {
        return false
      }

      if (
        typeof input?.amount === "number" &&
        typeof channel.max_amount === "number" &&
        input.amount > channel.max_amount
      ) {
        return false
      }

      return true
    })
  }

  async createPaymentAttemptForCart(input: CreatePaymentAttemptInput) {
    const currency = normalizeCurrencyCode(input.currency)

    if (!currency) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment currency must be a valid 3-letter code"
      )
    }

    const channels = await this.listAvailablePaymentChannels({
      amount: input.amount,
      currency,
    })

    const channel = channels.find((item) => item.code === input.paymentMethod)

    if (!channel) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Selected payment method is not available"
      )
    }

    const provider = getPaymentProvider(channel.provider_code)

    if (!provider) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Payment provider ${channel.provider_code} is not registered`
      )
    }

    const providerResult = await provider.createPayment({
      cartId: input.cartId,
      amount: input.amount,
      currency,
      paymentMethod: input.paymentMethod,
      customerEmail: input.customerEmail,
      metadata: input.metadata,
      channelConfig: channel.config_json as Record<string, unknown> | null,
    })

    const attempt = await this.createPaymentAttempts({
      cart_id: input.cartId,
      order_id: null,
      payment_channel_id: channel.id,
      provider_code: channel.provider_code,
      provider_order_id: providerResult.providerOrderId,
      amount: input.amount,
      currency,
      status: "pending",
      payment_url: providerResult.paymentUrl || null,
      qr_code_url: providerResult.qrCodeUrl || null,
      expires_at: providerResult.expiresAt || null,
      request_payload: {
        cart_id: input.cartId,
        payment_method: input.paymentMethod,
        customer_email: input.customerEmail,
        metadata: input.metadata || {},
      },
      response_payload: {
        ...(providerResult.responsePayload || {}),
        instructions: providerResult.instructions || null,
      },
      callback_payload: null,
      error_message: null,
      paid_at: null,
    })

    return {
      attempt,
      instructions: providerResult.instructions || null,
    }
  }

  async getPaymentAttemptStatus(id: string) {
    const attempt = await this.retrievePaymentAttempt(id)

    return {
      id: attempt.id,
      cart_id: attempt.cart_id,
      order_id: attempt.order_id,
      provider_order_id: attempt.provider_order_id,
      amount: attempt.amount,
      currency: attempt.currency,
      status: attempt.status,
      provider_code: attempt.provider_code,
      paid_at: attempt.paid_at,
    }
  }

  async markAttemptPaid(input: {
    id: string
    callbackPayload?: Record<string, unknown>
  }) {
    const attempt = await this.retrievePaymentAttempt(input.id)

    if (attempt.status === "paid") {
      return attempt
    }

    if (attempt.status !== "pending") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Cannot mark payment attempt with status ${attempt.status} as paid`
      )
    }

    return this.updatePaymentAttempts({
      id: attempt.id,
      status: "paid",
      paid_at: new Date(),
      callback_payload: input.callbackPayload || null,
    })
  }

  async markAttemptFailed(input: {
    id: string
    errorMessage: string
    callbackPayload?: Record<string, unknown>
  }) {
    const attempt = await this.retrievePaymentAttempt(input.id)

    if (attempt.status === "paid") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot fail a paid payment attempt"
      )
    }

    return this.updatePaymentAttempts({
      id: attempt.id,
      status: "failed",
      error_message: input.errorMessage,
      callback_payload: input.callbackPayload || null,
    })
  }

  async markAttemptExpired(input: {
    id: string
    callbackPayload?: Record<string, unknown>
  }) {
    const attempt = await this.retrievePaymentAttempt(input.id)

    if (attempt.status === "paid") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot expire a paid payment attempt"
      )
    }

    if (attempt.status === "expired") {
      return attempt
    }

    return this.updatePaymentAttempts({
      id: attempt.id,
      status: "expired",
      callback_payload: input.callbackPayload || null,
    })
  }

  async markAttemptPaidByProviderOrderId(input: {
    providerOrderId: string
    providerCode?: PaymentMethodCode | string
    callbackPayload?: Record<string, unknown>
  }) {
    const attempt = await this.retrievePaymentAttemptByProviderOrderId(input)

    return this.markAttemptPaid({
      id: attempt.id,
      callbackPayload: input.callbackPayload,
    })
  }

  async retrievePaymentAttemptByProviderOrderId(input: {
    providerOrderId: string
    providerCode?: PaymentMethodCode | string
  }) {
    const attempts = await this.listPaymentAttempts({
      provider_order_id: input.providerOrderId,
    })
    const attempt = attempts.find((item) =>
      input.providerCode ? item.provider_code === input.providerCode : true
    )

    if (!attempt) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Payment attempt not found"
      )
    }

    return attempt
  }

  assertProviderRegistered(providerCode: string) {
    if (!hasPaymentProvider(providerCode)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Payment provider ${providerCode} is not registered`
      )
    }
  }
}

export default PaymentRouterModuleService

function normalizeCurrencyCode(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim().toLowerCase()

  return /^[a-z]{3}$/.test(normalized) ? normalized : ""
}

function isUniqueConstraintViolation(error: unknown): boolean {
  const queue: unknown[] = [error]

  while (queue.length) {
    const current = queue.shift()

    if (!current || typeof current !== "object") {
      continue
    }

    const record = current as Record<string, unknown>
    const code = typeof record.code === "string" ? record.code : ""
    const message = typeof record.message === "string" ? record.message : ""

    if (code === "23505") {
      return true
    }

    if (
      /unique/i.test(message) &&
      /payment_channel|IDX_payment_channel_code_unique/i.test(message)
    ) {
      return true
    }

    if (record.cause) {
      queue.push(record.cause)
    }

    if (record.originalError) {
      queue.push(record.originalError)
    }
  }

  return false
}
