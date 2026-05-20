import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveDigitalDeliveryService } from "../../../../platform/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import { localizedError } from "../../../../utils/localized-response"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import createManualDeliveryWorkflow from "../../../../workflows/create-manual-delivery"

type CreateDeliveryBody = {
  delivery_id?: string
  order_id?: string
  cart_id?: string
  payment_attempt_id?: string
  order_item_id?: string
  account_item_id?: string
  delivery_payload?: Record<string, unknown> | string
  delivery_status?: "pending" | "delivered"
  delivered_by?: string
  delivery_note?: string
  metadata?: Record<string, unknown>
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const deliveryService = resolveDigitalDeliveryService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    status?: string
    order_id?: string
    cart_id?: string
    payment_attempt_id?: string
    limit?: number
  }

  const deliveries = await deliveryService.listDeliveriesSafe({
    status: query.status,
    orderId: query.order_id,
    cartId: query.cart_id,
    paymentAttemptId: query.payment_attempt_id,
    limit:
      typeof query.limit === "number" && Number.isFinite(query.limit)
        ? query.limit
        : undefined,
  })

  res.json({
    deliveries,
  })
}

export const POST = async (
  req: MedusaRequest<CreateDeliveryBody>,
  res: MedusaResponse
) => {
  if (
    !req.body.account_item_id &&
    !req.body.delivery_payload &&
    !req.body.delivery_id
  ) {
    localizedError(req, res, 400, "delivery.required")
    return
  }

  if (req.body.delivery_id && !req.body.delivery_payload) {
    localizedError(req, res, 400, "delivery.payloadRequired")
    return
  }

  const { actorId, ipAddress, userAgent } = getRequestAuditContext(req)
  const workflowResult = await createManualDeliveryWorkflow(req.scope).run({
    input: {
      deliveryId: req.body.delivery_id,
      orderId: req.body.order_id,
      cartId: req.body.cart_id,
      paymentAttemptId: req.body.payment_attempt_id,
      orderItemId: req.body.order_item_id,
      accountItemId: req.body.account_item_id,
      deliveryPayload: req.body.delivery_payload,
      deliveryStatus:
        req.body.delivery_status ||
        (req.body.delivery_id ? "delivered" : undefined),
      deliveredBy: req.body.delivered_by,
      deliveryNote: req.body.delivery_note,
      metadata: req.body.metadata,
    },
  })

  const result = workflowResult.result

  await emitAuditLog(req.scope, {
    actorType: "admin",
    actorId,
    action:
      result.created === false && result.updated
        ? "delivery.completed"
        : "delivery.created",
    entityType: "order_delivery",
    entityId: String(result.delivery.id),
    riskLevel: "high",
    ipAddress,
    userAgent,
    metadata: {
      account_item_id: req.body.account_item_id,
      access_token_returned: Boolean(result.accessToken),
      order_id: result.orderId || req.body.order_id || null,
    },
  })

  res.status(201).json(result)
}
