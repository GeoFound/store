import type { MarketingStrategy } from "../../../platform/marketing"
import { registerMarketingStrategy } from "../../../platform/marketing"
import { MARKETING_ENGINE_PLUGIN_MANIFEST } from "../plugin"
import { MARKETING_ENGINE_MODULE } from ".."
import type MarketingEngineModuleService from "../service"

let strategiesRegistered = false

const couponCodeStrategy: MarketingStrategy = {
  code: "coupon-code",
  async resolve(input) {
    const couponCode = normalizeCode(input.context.coupon_code)

    if (!couponCode) {
      return null
    }

    const marketing: MarketingEngineModuleService = input.scope.resolve(
      MARKETING_ENGINE_MODULE
    )

    const reserved = await marketing.reserveCouponForAttempt({
      scope: input.scope,
      attemptId: input.attemptId,
      couponCode,
      customerEmail: input.customerEmail || null,
      metadata: {
        cart_id: input.cartId,
        amount: input.amount,
        currency: input.currency,
      },
    })

    const couponCampaign = await safeReadCampaignCode(
      marketing,
      reserved.coupon.campaign_id
    )
    const couponOffer = await safeReadOfferCode(marketing, reserved.coupon.offer_id)

    return {
      coupon: {
        code: reserved.coupon.code,
        coupon_id: reserved.coupon.id,
        campaign_code: couponCampaign,
        offer_code: couponOffer,
        reservation_id: reserved.redemption.id,
      },
      tags: ["coupon:reserved"],
    }
  },
  async onAttemptPaid(input) {
    const couponCode = input.context.coupon?.code

    if (!couponCode || !input.orderId) {
      return
    }

    const marketing: MarketingEngineModuleService = input.scope.resolve(
      MARKETING_ENGINE_MODULE
    )

    await marketing.confirmCouponForAttempt({
      scope: input.scope,
      attemptId: input.attemptId,
      orderId: input.orderId,
    })
  },
  async onAttemptClosed(input) {
    const couponCode = input.context.coupon?.code

    if (!couponCode) {
      return
    }

    const marketing: MarketingEngineModuleService = input.scope.resolve(
      MARKETING_ENGINE_MODULE
    )

    await marketing.releaseCouponForAttempt({
      scope: input.scope,
      attemptId: input.attemptId,
      reason: "payment_closed",
    })
  },
}

const referralLinkStrategy: MarketingStrategy = {
  code: "referral-link",
  async resolve(input) {
    const referralCode = normalizeCode(input.context.referral_code)

    if (!referralCode) {
      return null
    }

    const marketing: MarketingEngineModuleService = input.scope.resolve(
      MARKETING_ENGINE_MODULE
    )

    const link = await marketing.resolveActiveReferralLinkByCode(referralCode)
    const referralCampaign = await safeReadCampaignCode(marketing, link.campaign_id)

    return {
      referral: {
        code: link.code,
        referral_link_id: link.id,
        campaign_code: referralCampaign,
      },
      tags: ["referral:resolved"],
    }
  },
  async onAttemptPaid(input) {
    const referralCode = input.context.referral?.code

    if (!referralCode || !input.orderId) {
      return
    }

    const marketing: MarketingEngineModuleService = input.scope.resolve(
      MARKETING_ENGINE_MODULE
    )

    await marketing.finalizeReferralReward({
      scope: input.scope,
      attemptId: input.attemptId,
      orderId: input.orderId,
      customerEmail: input.customerEmail || null,
      resolvedContext: input.context,
    })
  },
}

const attributionStrategy: MarketingStrategy = {
  code: "utm-attribution",
  resolve(input) {
    const attribution = {
      source: normalizeText(input.context.utm_source),
      medium: normalizeText(input.context.utm_medium),
      campaign: normalizeText(input.context.utm_campaign),
      content: normalizeText(input.context.utm_content),
      term: normalizeText(input.context.utm_term),
    }

    if (!Object.values(attribution).some(Boolean)) {
      return null
    }

    return {
      attribution,
      tags: ["attribution:utm"],
    }
  },
}

export function ensureMarketingStrategiesRegistered() {
  if (strategiesRegistered) {
    return
  }

  registerMarketingStrategy(couponCodeStrategy, {
    pluginId: MARKETING_ENGINE_PLUGIN_MANIFEST.id,
    version: "v1",
    priority: 300,
    enabled: true,
    description: "Reserves and confirms coupon redemptions for payment attempts.",
  })

  registerMarketingStrategy(referralLinkStrategy, {
    pluginId: MARKETING_ENGINE_PLUGIN_MANIFEST.id,
    version: "v1",
    priority: 250,
    enabled: true,
    description: "Validates referral links and issues referrer rewards after payment.",
  })

  registerMarketingStrategy(attributionStrategy, {
    pluginId: MARKETING_ENGINE_PLUGIN_MANIFEST.id,
    version: "v1",
    priority: 200,
    enabled: true,
    description: "Captures UTM attribution into checkout context.",
  })

  strategiesRegistered = true
}

export function resetMarketingStrategiesForTests() {
  strategiesRegistered = false
}

async function safeReadCampaignCode(
  marketing: MarketingEngineModuleService,
  campaignId?: string | null
) {
  if (!campaignId) {
    return null
  }

  try {
    const campaign = await marketing.retrieveMarketingCampaign(campaignId)
    return typeof campaign.code === "string" ? campaign.code : null
  } catch {
    return null
  }
}

async function safeReadOfferCode(
  marketing: MarketingEngineModuleService,
  offerId?: string | null
) {
  if (!offerId) {
    return null
  }

  try {
    const offer = await marketing.retrieveMarketingOffer(offerId)
    return typeof offer.code === "string" ? offer.code : null
  } catch {
    return null
  }
}

function normalizeCode(value: string | undefined) {
  if (!value || !value.trim()) {
    return ""
  }

  return value.trim().toUpperCase()
}

function normalizeText(value: string | undefined) {
  if (!value || !value.trim()) {
    return undefined
  }

  return value.trim().slice(0, 160)
}
