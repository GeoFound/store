import { model } from "@medusajs/framework/utils"

const OrderAccessToken = model.define("order_access_token", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  customer_email: model.text(),
  purpose: model.enum(["view_order", "claim_order"]).default("view_order"),
  token_hash: model.text(),
  token_hint: model.text().nullable(),
  expires_at: model.dateTime().nullable(),
  used_at: model.dateTime().nullable(),
  revoked_at: model.dateTime().nullable(),
  failed_attempts: model.number().default(0),
  last_failed_at: model.dateTime().nullable(),
  blocked_until: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default OrderAccessToken
