import { model } from "@medusajs/framework/utils"

const PaymentChannel = model.define("payment_channel", {
  id: model.id().primaryKey(),
  code: model.text(),
  name: model.text(),
  display_name: model.text(),
  type: model.text(),
  enabled: model.boolean().default(true),
  priority: model.number().default(100),
  min_amount: model.number().nullable(),
  max_amount: model.number().nullable(),
  currency: model.text().nullable(),
  provider_code: model.text(),
  config_json: model.json().nullable(),
  health_status: model.enum(["healthy", "degraded", "down"]).default("healthy"),
})

export default PaymentChannel
