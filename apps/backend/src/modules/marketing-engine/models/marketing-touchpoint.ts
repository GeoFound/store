import { model } from "@medusajs/framework/utils"

const MarketingTouchpoint = model.define("marketing_touchpoint", {
  id: model.id().primaryKey(),
  cart_id: model.text().nullable(),
  payment_attempt_id: model.text().nullable(),
  order_id: model.text().nullable(),
  customer_email: model.text().nullable(),
  event_name: model.text(),
  coupon_code: model.text().nullable(),
  referral_code: model.text().nullable(),
  source: model.text().nullable(),
  medium: model.text().nullable(),
  campaign: model.text().nullable(),
  content: model.text().nullable(),
  term: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingTouchpoint
