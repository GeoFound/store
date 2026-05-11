import { model } from "@medusajs/framework/utils"

const MarketingCouponRedemption = model.define("marketing_coupon_redemption", {
  id: model.id().primaryKey(),
  coupon_id: model.text(),
  coupon_code: model.text(),
  payment_attempt_id: model.text().nullable(),
  order_id: model.text().nullable(),
  customer_email: model.text().nullable(),
  status: model.enum(["reserved", "confirmed", "released"]).default("reserved"),
  reserved_at: model.dateTime().nullable(),
  confirmed_at: model.dateTime().nullable(),
  released_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingCouponRedemption
