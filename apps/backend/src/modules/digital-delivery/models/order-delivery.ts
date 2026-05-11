import { model } from "@medusajs/framework/utils"

const OrderDelivery = model.define("order_delivery", {
  id: model.id().primaryKey(),
  order_id: model.text().nullable(),
  cart_id: model.text().nullable(),
  payment_attempt_id: model.text().nullable(),
  order_item_id: model.text().nullable(),
  account_item_id: model.text().nullable(),
  delivery_status: model
    .enum(["pending", "delivered", "confirmed", "replaced", "refunded"])
    .default("pending"),
  delivery_payload_encrypted: model.text(),
  delivery_payload_version: model.number().default(1),
  access_token_hash: model.text(),
  access_token_hint: model.text(),
  delivered_by: model.text().nullable(),
  delivered_at: model.dateTime().nullable(),
  buyer_confirmed_at: model.dateTime().nullable(),
  delivery_note: model.text().nullable(),
  retry_count: model.number().default(0),
  replacement_for_delivery_id: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default OrderDelivery
