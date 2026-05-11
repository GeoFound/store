import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveDigitalDeliveryService } from "../../../../platform/services"
import { emitAuditLog } from "../../../../utils/audit-log"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import createManualDeliveryWorkflow from "../../../../workflows/create-manual-delivery"

type CreateDeliveryBody = {
  order_id?: string
  cart_id?: string
  payment_attempt_id?: string
  order_item_id?: string
  account_item_id?: string
  delivery_payload?: Record<string, unknown> | string
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
  if (!req.body.account_item_id && !req.body.delivery_payload) {
    res.status(400).json({
      message: "account_item_id or delivery_payload is required",
    })
    return
  }

  const { actorId, ipAddress, userAgent } = getRequestAuditContext(req)
  const workflowResult = await createManualDeliveryWorkflow(req.scope).run({
    input: {
      orderId: req.body.order_id,
      cartId: req.body.cart_id,
      paymentAttemptId: req.body.payment_attempt_id,
      orderItemId: req.body.order_item_id,
      accountItemId: req.body.account_item_id,
      deliveryPayload: req.body.delivery_payload,
      deliveredBy: req.body.delivered_by,
      deliveryNote: req.body.delivery_note,
      metadata: req.body.metadata,
    },
  })

  const result = workflowResult.result

  await emitAuditLog(req.scope, {
    actorType: "admin",
    actorId,
    action: "delivery.created",
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
