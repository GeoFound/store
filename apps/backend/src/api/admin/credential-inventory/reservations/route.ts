import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reserveCredentialsWithLock } from "../../../../utils/inventory-reservation"
import { localizedError } from "../../../../utils/localized-response"

type ReserveBody = {
  product_variant_id?: string
  quantity?: number
  reservation_key?: string
  cart_id?: string
  order_id?: string
  ttl_seconds?: number
}

export const POST = async (
  req: MedusaRequest<ReserveBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as ReserveBody

  if (!body.product_variant_id || !body.reservation_key) {
    localizedError(req, res, 400, "credentialReservation.required")
    return
  }

  const items = await reserveCredentialsWithLock(req.scope, {
    productVariantId: body.product_variant_id,
    quantity: body.quantity || 1,
    reservationKey: body.reservation_key,
    cartId: body.cart_id,
    orderId: body.order_id,
    ttlSeconds: body.ttl_seconds,
  })

  res.status(201).json({
    items,
  })
}
