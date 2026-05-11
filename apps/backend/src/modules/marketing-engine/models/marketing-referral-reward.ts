import { model } from "@medusajs/framework/utils"

const MarketingReferralReward = model.define("marketing_referral_reward", {
  id: model.id().primaryKey(),
  referral_link_id: model.text(),
  referee_order_id: model.text().nullable(),
  referee_payment_attempt_id: model.text().nullable(),
  referrer_reward_type: model.enum(["coupon", "credit", "commission"]).default("coupon"),
  reward_value: model.text().nullable(),
  status: model.enum(["pending", "issued", "revoked"]).default("pending"),
  issued_at: model.dateTime().nullable(),
  metadata_json: model.json().nullable(),
})

export default MarketingReferralReward
