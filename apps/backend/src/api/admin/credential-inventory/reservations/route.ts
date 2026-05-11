import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reserveCredentialsWithLock } from "../../../../utils/inventory-reservation"

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
  if (!req.body.product_variant_id || !req.body.reservation_key) {
    res.status(400).json({
      message: "product_variant_id and reservation_key are required",
    })
    return
  }

  const items = await reserveCredentialsWithLock(req.scope, {
    productVariantId: req.body.product_variant_id,
    quantity: req.body.quantity || 1,
    reservationKey: req.body.reservation_key,
    cartId: req.body.cart_id,
    orderId: req.body.order_id,
    ttlSeconds: req.body.ttl_seconds,
  })

  res.status(201).json({
    items,
  })
}
