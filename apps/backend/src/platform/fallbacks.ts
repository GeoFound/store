import type { PaymentProvider } from "../modules/payment-router/providers/types"
import type {
  CreateDeliveryInput,
  CreateDeliveryResult,
  DeliveryHandler,
  ProductFulfillmentPolicy,
} from "./delivery"
import type { InventoryHandler } from "./inventory"
import type { MarketingStrategy } from "./marketing"
import type { OrderAccessProvider } from "./order-access"

export function createNoopPaymentProvider(reason = "noop"): PaymentProvider {
  return {
    code: "noop",
    createPayment() {
      return {
        providerOrderId: `noop_${reason}_${Date.now()}`,
        paymentUrl: null,
        qrCodeUrl: null,
        expiresAt: null,
        responsePayload: {
          reason,
        },
        instructions: {
          title: "No payment provider available",
          body: "This capability is disabled or unavailable. Enable a provider to accept payment.",
          reference: reason,
        },
      }
    },
    parseWebhook() {
      throw new Error("No-op payment provider cannot parse webhooks")
    },
  }
}

export function createNoopDeliveryHandler(reason = "noop"): DeliveryHandler {
  return {
    code: "noop",
    createDelivery(input: CreateDeliveryInput): CreateDeliveryResult {
      return {
        delivery: {
          id: `noop_delivery_${reason}_${Date.now()}`,
          delivery_status: "pending",
          account_item_id: input.accountItemId || null,
          order_id: input.orderId || null,
          cart_id: input.cartId || null,
          payment_attempt_id: input.paymentAttemptId || null,
          order_item_id: input.orderItemId || null,
          delivered_by: input.deliveredBy || null,
          delivered_at: null,
          buyer_confirmed_at: null,
          delivery_note: input.deliveryNote || null,
          metadata_json: input.metadata || null,
          fallback_reason: reason,
        },
        accessToken: null,
      }
    },
  }
}

export function createNoopInventoryHandler(reason = "noop"): InventoryHandler {
  return {
    code: "noop",
    reserve() {
      return []
    },
    finalizeReservation() {
      return undefined
    },
    releaseReservation() {
      return undefined
    },
    listAvailability({ variantIds }) {
      return variantIds.map((variantId) => ({
        variant_id: variantId,
        total_count: 0,
        available_count: 0,
        reserved_count: 0,
        sold_count: 0,
        locked_count: 0,
        is_in_stock: false,
      }))
    },
  }
}

export function createNoopOrderAccessProvider(
  reason = "noop"
): OrderAccessProvider {
  return {
    code: "noop",
    issueToken() {
      throw new Error(`Order access provider is unavailable: ${reason}`)
    },
    revokeActiveTokens() {
      return undefined
    },
  }
}

export function createDefaultFulfillmentPolicy(): ProductFulfillmentPolicy {
  return {
    code: "default",
    resolvePlan(input) {
      const productType = String(
        input.productType ||
          input.metadata?.product_type ||
          input.metadata?.productType ||
          input.metadata?.template_code ||
          input.metadata?.templateCode ||
          ""
      )

      if (["file", "manual", "api"].includes(productType)) {
        return {
          code: "default:no-inventory",
          deliveryHandlerCode: "manual",
          inventoryHandlerCode: "noop",
          inventoryMode: "none",
        }
      }

      return {
        code: "default:credential",
        deliveryHandlerCode: "credential",
        inventoryHandlerCode: "credential-inventory",
        inventoryMode: "reserve",
      }
    },
  }
}

export function createNoopMarketingStrategy(
  reason = "noop"
): MarketingStrategy {
  return {
    code: "noop",
    resolve() {
      void reason
      return null
    },
  }
}
