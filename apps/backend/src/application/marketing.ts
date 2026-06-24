export type StorefrontMarketingCampaign = Record<string, unknown> & {
  starts_at?: unknown
  ends_at?: unknown
}

export type StorefrontMarketingCampaignListInput = {
  limit?: number | string | null
}

export type StorefrontMarketingCampaignQuery = {
  status: "active"
  limit: number
}

export type StorefrontMarketingRepository = {
  listCampaigns(
    input: StorefrontMarketingCampaignQuery
  ): Promise<StorefrontMarketingCampaign[]>
}

export type StorefrontMarketingApplication = {
  listPublicCampaigns(
    input?: StorefrontMarketingCampaignListInput
  ): Promise<StorefrontMarketingCampaign[]>
}

export function createStorefrontMarketingApplication(
  repository: StorefrontMarketingRepository,
  options: { now?: () => number } = {}
): StorefrontMarketingApplication {
  const now = options.now || Date.now

  return {
    async listPublicCampaigns(input = {}) {
      const campaigns = await repository.listCampaigns({
        status: "active",
        limit: normalizeLimit(input.limit, 50),
      })
      const timestamp = now()

      return campaigns.filter((campaign) =>
        isCampaignVisibleAt(campaign, timestamp)
      )
    },
  }
}

function isCampaignVisibleAt(
  campaign: StorefrontMarketingCampaign,
  now: number
) {
  if (isAfter(campaign.starts_at, now)) {
    return false
  }

  if (isAtOrBefore(campaign.ends_at, now)) {
    return false
  }

  return true
}

function isAfter(value: unknown, timestamp: number) {
  const time = toTime(value)

  return typeof time === "number" && time > timestamp
}

function isAtOrBefore(value: unknown, timestamp: number) {
  const time = toTime(value)

  return typeof time === "number" && time <= timestamp
}

function toTime(value: unknown) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(String(value))
  const time = date.getTime()

  return Number.isFinite(time) ? time : null
}

function normalizeLimit(
  value: StorefrontMarketingCampaignListInput["limit"],
  fallback: number
) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback
  }

  return Math.min(Math.floor(numberValue), 200)
}
