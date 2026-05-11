import { model } from "@medusajs/framework/utils"

const MarketingOffer = model.define("marketing_offer", {
  id: model.id().primaryKey(),
  campaign_id: model.text().nullable(),
  code: model.text(),
  name: model.text(),
  type: model
    .enum(["coupon", "bundle", "referral", "upsell", "email_flow", "custom"])
    .default("custom"),
  status: model.enum(["draft", "active", "paused", "archived"]).default("draft"),
  priority: model.number().default(100),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  conditions_json: model.json().nullable(),
  reward_json: model.json().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingOffer
