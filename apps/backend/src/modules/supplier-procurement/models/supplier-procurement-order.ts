import { model } from "@medusajs/framework/utils"

const SupplierProcurementOrder = model.define("supplier_procurement_order", {
  id: model.id().primaryKey(),
  idempotency_key: model.text(),
  provider_code: model.text(),
  provider_order_id: model.text().nullable(),
  status: model
    .enum(["pending", "processing", "fulfilled", "failed", "cancelled", "needs_review"])
    .default("pending"),
  product_variant_id: model.text().nullable(),
  order_id: model.text().nullable(),
  cart_id: model.text().nullable(),
  payment_attempt_id: model.text().nullable(),
  order_item_id: model.text().nullable(),
  quantity: model.number().default(1),
  currency: model.text().nullable(),
  cost_amount: model.number().nullable(),
  cost_currency: model.text().nullable(),
  request_payload: model.json().nullable(),
  response_payload: model.json().nullable(),
  fulfillment_payload_encrypted: model.text().nullable(),
  fulfillment_payload_version: model.number().default(1),
  error_message: model.text().nullable(),
  retry_count: model.number().default(0),
  next_retry_at: model.dateTime().nullable(),
  fulfilled_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default SupplierProcurementOrder
