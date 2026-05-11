import { model } from "@medusajs/framework/utils"

const MarketingCampaign = model.define("marketing_campaign", {
  id: model.id().primaryKey(),
  code: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  status: model.enum(["draft", "active", "paused", "archived"]).default("draft"),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  budget_limit: model.number().nullable(),
  spent_amount: model.number().default(0),
  metadata_json: model.json().nullable(),
})

export default MarketingCampaign
