import type { MedusaContainer } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import {
  emitDeliveryCompletedEvent,
  emitDeliveryCreatedEvent,
} from "../../../platform/events"
import { resolveDeliveryHandlerCode } from "../../../platform/delivery"
import { ensurePlatformIntegrationsRegistered } from "../../../platform-adapters/integrations"
import { resolveProductTemplate } from "../../../platform/product-templates"
import {
  resolveDigitalDeliveryService,
  resolvePaymentRouterService,
} from "../../../platform-adapters/services"

export type CreateDeliveryStepInput = {
  deliveryId?: string
  orderId?: string
  cartId?: string
  paymentAttemptId?: string
  orderItemId?: string
  accountItemId?: string | null
  productVariantId?: string
  productType?: string | null
  fulfillmentPolicyCode?: string | null
  deliveryHandlerCode?: string | null
  deliveryStatus?: "pending" | "delivered"
  deliveryPayload?: Record<string, unknown> | string
  deliveredBy?: string
  deliveryNote?: string
  metadata?: Record<string, unknown>
}

export const createDeliveryStep = createStep(
  "create-delivery",
  async (
    input: CreateDeliveryStepInput,
    { container }: { container: MedusaContainer }
  ) => {
    ensurePlatformIntegrationsRegistered()

    const deliveryService = resolveDigitalDeliveryService(container)
    const paymentRouter = resolvePaymentRouterService(container)

    const deliveryMetadata = {
      ...(input.metadata || {}),
    }
    const explicitTemplateCode =
      toOptionalString(
        deliveryMetadata.template_code ||
          deliveryMetadata.templateCode ||
          deliveryMetadata.product_template ||
          deliveryMetadata.productTemplate
      ) || undefined
    const productTemplate = resolveProductTemplate({
      code: explicitTemplateCode,
      productType:
        toOptionalString(
          deliveryMetadata.product_type || deliveryMetadata.productType
        ) || null,
      metadata: deliveryMetadata,
    })

    if (explicitTemplateCode && !productTemplate) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown product template code "${explicitTemplateCode}"`
      )
    }

    const paymentAttempt = input.paymentAttemptId
      ? await paymentRouter.retrievePaymentAttempt(input.paymentAttemptId)
      : null
    const orderId = input.orderId || paymentAttempt?.order_id || undefined

    const result = await deliveryService.createDelivery({
      scope: container,
      deliveryId: input.deliveryId,
      orderId,
      cartId: input.cartId,
      paymentAttemptId: input.paymentAttemptId,
      orderItemId: input.orderItemId,
      accountItemId: input.accountItemId,
      productVariantId: input.productVariantId,
      productType:
        input.productType ||
        toOptionalString(
          deliveryMetadata.product_type || deliveryMetadata.productType
        ) ||
        productTemplate?.productType ||
        null,
      fulfillmentPolicyCode:
        input.fulfillmentPolicyCode ||
        toOptionalString(
          deliveryMetadata.fulfillment_policy_code ||
            deliveryMetadata.fulfillmentPolicyCode
        ) ||
        productTemplate?.fulfillmentPolicyCode ||
        undefined,
      deliveryHandlerCode: resolveDeliveryHandlerCode({
        deliveryHandlerCode: input.deliveryHandlerCode,
        metadata: deliveryMetadata,
        accountItemId: input.accountItemId || null,
        templateDeliveryHandlerCode: productTemplate?.deliveryHandlerCode,
        deliveryId: input.deliveryId || null,
        deliveryPayload: input.deliveryPayload,
      }),
      deliveryPayload: input.deliveryPayload,
      deliveryStatus: input.deliveryStatus,
      deliveredBy: input.deliveredBy,
      deliveryNote: input.deliveryNote,
      metadata: {
        template_code: productTemplate?.code || null,
        ...deliveryMetadata,
      },
    })

    const eventPayload = {
      delivery: result.delivery,
      accessToken: result.accessToken,
      orderId,
      metadata: {
        template_code: productTemplate?.code || null,
        ...deliveryMetadata,
      },
    }

    if (result.created === false && result.updated) {
      try {
        await emitDeliveryCompletedEvent(container, eventPayload)
      } catch {
        // Hook consumers must not break the delivery flow.
      }
    } else if (result.created !== false) {
      try {
        await emitDeliveryCreatedEvent(container, eventPayload)
      } catch {
        // Hook consumers must not break the delivery flow.
      }
    }

    return new StepResponse({
      ...result,
      orderId,
      deliveryMetadata: {
        template_code: productTemplate?.code || null,
        ...deliveryMetadata,
      },
    })
  }
)

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
