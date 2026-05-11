import { model } from "@medusajs/framework/utils"

const PaymentAttempt = model.define("payment_attempt", {
  id: model.id().primaryKey(),
  cart_id: model.text().nullable(),
  order_id: model.text().nullable(),
  payment_channel_id: model.text(),
  provider_code: model.text(),
  provider_order_id: model.text().nullable(),
  amount: model.number(),
  currency: model.text(),
  status: model
    .enum(["pending", "paid", "failed", "expired", "partial", "refunded"])
    .default("pending"),
  payment_url: model.text().nullable(),
  qr_code_url: model.text().nullable(),
  expires_at: model.dateTime().nullable(),
  request_payload: model.json().nullable(),
  response_payload: model.json().nullable(),
  callback_payload: model.json().nullable(),
  error_message: model.text().nullable(),
  paid_at: model.dateTime().nullable(),
})

export default PaymentAttempt
