import { model } from "@medusajs/framework/utils"

const MarketingReferralLink = model.define("marketing_referral_link", {
  id: model.id().primaryKey(),
  campaign_id: model.text().nullable(),
  code: model.text(),
  referrer_id: model.text().nullable(),
  referrer_email: model.text().nullable(),
  status: model.enum(["active", "disabled"]).default("active"),
  max_uses: model.number().nullable(),
  used_count: model.number().default(0),
  landing_path: model.text().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingReferralLink
