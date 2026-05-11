import { model } from "@medusajs/framework/utils"

const MarketingCoupon = model.define("marketing_coupon", {
  id: model.id().primaryKey(),
  campaign_id: model.text().nullable(),
  offer_id: model.text().nullable(),
  code: model.text(),
  status: model.enum(["active", "disabled", "expired"]).default("active"),
  max_redemptions: model.number().nullable(),
  max_redemptions_per_email: model.number().nullable(),
  redeemed_count: model.number().default(0),
  starts_at: model.dateTime().nullable(),
  expires_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingCoupon
