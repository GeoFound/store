import type { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, MedusaService, Modules } from "@medusajs/framework/utils"
import MarketingCampaign from "./models/marketing-campaign"
import MarketingOffer from "./models/marketing-offer"
import MarketingCoupon from "./models/marketing-coupon"
import MarketingCouponRedemption from "./models/marketing-coupon-redemption"
import MarketingReferralLink from "./models/marketing-referral-link"
import MarketingReferralReward from "./models/marketing-referral-reward"
import MarketingTouchpoint from "./models/marketing-touchpoint"
import type {
  ConfirmCouponForAttemptInput,
  CreateMarketingCampaignInput,
  CreateMarketingCouponInput,
  CreateMarketingOfferInput,
  CreateMarketingReferralLinkInput,
  FinalizeReferralRewardInput,
  RecordMarketingTouchpointInput,
  ReleaseCouponForAttemptInput,
  ReserveCouponForAttemptInput,
} from "./types"
import {
  normalizeCode,
  normalizeCodeOptional,
  normalizeEmail,
  normalizeLimit,
  normalizeRecord,
  requireText,
  toDateOrNull,
  toNullableNumber,
  toNullableText,
} from "./service-normalizers"

class MarketingEngineModuleService extends MedusaService({
  MarketingCampaign,
  MarketingOffer,
  MarketingCoupon,
  MarketingCouponRedemption,
  MarketingReferralLink,
  MarketingReferralReward,
  MarketingTouchpoint,
}) {
  async createCampaignSafe(input: CreateMarketingCampaignInput) {
    const code = normalizeCode(input.code, "campaign code")

    await this.assertCodeIsUnique("campaign", code)

    return this.createMarketingCampaigns({
      code,
      name: requireText(input.name, "campaign name"),
      description: toNullableText(input.description),
      status: input.status || "draft",
      starts_at: toDateOrNull(input.startsAt),
      ends_at: toDateOrNull(input.endsAt),
      budget_limit: toNullableNumber(input.budgetLimit),
      spent_amount: 0,
      metadata_json: normalizeRecord(input.metadata),
    })
  }

  async listCampaignsSafe(input?: {
    status?: string
    code?: string
    limit?: number
  }) {
    return this.listMarketingCampaigns(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.code ? { code: normalizeCode(input.code, "campaign code") } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async createOfferSafe(input: CreateMarketingOfferInput) {
    const code = normalizeCode(input.code, "offer code")

    await this.assertCodeIsUnique("offer", code)

    return this.createMarketingOffers({
      campaign_id: toNullableText(input.campaignId),
      code,
      name: requireText(input.name, "offer name"),
      type: input.type || "custom",
      status: input.status || "draft",
      priority: toNullableNumber(input.priority) ?? 100,
      starts_at: toDateOrNull(input.startsAt),
      ends_at: toDateOrNull(input.endsAt),
      conditions_json: normalizeRecord(input.conditions),
      reward_json: normalizeRecord(input.reward),
      metadata_json: normalizeRecord(input.metadata),
    })
  }

  async listOffersSafe(input?: {
    status?: string
    code?: string
    campaignId?: string
    limit?: number
  }) {
    return this.listMarketingOffers(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.campaignId ? { campaign_id: input.campaignId } : {}),
        ...(input?.code ? { code: normalizeCode(input.code, "offer code") } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          priority: "ASC",
          created_at: "DESC",
        },
      }
    )
  }

  async createCouponSafe(input: CreateMarketingCouponInput) {
    const code = normalizeCode(input.code, "coupon code")

    await this.assertCodeIsUnique("coupon", code)

    return this.createMarketingCoupons({
      campaign_id: toNullableText(input.campaignId),
      offer_id: toNullableText(input.offerId),
      code,
      status: input.status || "active",
      max_redemptions: toNullableNumber(input.maxRedemptions),
      max_redemptions_per_email: toNullableNumber(input.maxRedemptionsPerEmail),
      redeemed_count: 0,
      starts_at: toDateOrNull(input.startsAt),
      expires_at: toDateOrNull(input.expiresAt),
      metadata_json: normalizeRecord(input.metadata),
    })
  }

  async listCouponsSafe(input?: {
    status?: string
    code?: string
    campaignId?: string
    limit?: number
  }) {
    return this.listMarketingCoupons(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.campaignId ? { campaign_id: input.campaignId } : {}),
        ...(input?.code ? { code: normalizeCode(input.code, "coupon code") } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async createReferralLinkSafe(input: CreateMarketingReferralLinkInput) {
    const code = normalizeCode(input.code, "referral code")

    await this.assertCodeIsUnique("referral", code)

    return this.createMarketingReferralLinks({
      campaign_id: toNullableText(input.campaignId),
      code,
      referrer_id: toNullableText(input.referrerId),
      referrer_email: normalizeEmail(input.referrerEmail),
      status: input.status || "active",
      max_uses: toNullableNumber(input.maxUses),
      used_count: 0,
      landing_path: toNullableText(input.landingPath),
      metadata_json: normalizeRecord(input.metadata),
    })
  }

  async listReferralLinksSafe(input?: {
    status?: string
    code?: string
    campaignId?: string
    limit?: number
  }) {
    return this.listMarketingReferralLinks(
      {
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.campaignId ? { campaign_id: input.campaignId } : {}),
        ...(input?.code ? { code: normalizeCode(input.code, "referral code") } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async reserveCouponForAttempt(input: ReserveCouponForAttemptInput) {
    const locking = input.scope.resolve<ILockingModule>(Modules.LOCKING)
    const couponCode = normalizeCode(input.couponCode, "coupon code")
    const customerEmail = normalizeEmail(input.customerEmail)

    return locking.execute(
      [`marketing_coupon:${couponCode}`, `payment_attempt:${input.attemptId}`],
      async () => {
        const existingByAttempt = await this.listMarketingCouponRedemptions(
          {
            payment_attempt_id: input.attemptId,
          },
          {
            take: 1,
            order: {
              created_at: "DESC",
            },
          }
        )

        const existing = existingByAttempt[0]

        if (existing && existing.status !== "released") {
          return {
            coupon: await this.retrieveMarketingCoupon(existing.coupon_id),
            redemption: existing,
          }
        }

        const coupon = await this.getActiveCouponByCode(couponCode)

        if (coupon.max_redemptions_per_email && customerEmail) {
          const emailUsage = await this.listMarketingCouponRedemptions(
            {
              coupon_id: coupon.id,
              customer_email: customerEmail,
              status: "confirmed",
            },
            {
              take: Math.max(coupon.max_redemptions_per_email + 1, 20),
            }
          )

          if (emailUsage.length >= coupon.max_redemptions_per_email) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              "Coupon usage limit reached for this email"
            )
          }
        }

        if (coupon.max_redemptions) {
          const reserved = await this.listMarketingCouponRedemptions(
            {
              coupon_id: coupon.id,
              status: "reserved",
            },
            {
              take: coupon.max_redemptions + 1,
            }
          )
          const confirmed = await this.listMarketingCouponRedemptions(
            {
              coupon_id: coupon.id,
              status: "confirmed",
            },
            {
              take: coupon.max_redemptions + 1,
            }
          )

          if (reserved.length + confirmed.length >= coupon.max_redemptions) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              "Coupon reached maximum redemptions"
            )
          }
        }

        const redemption = await this.createMarketingCouponRedemptions({
          coupon_id: coupon.id,
          coupon_code: coupon.code,
          payment_attempt_id: input.attemptId,
          order_id: null,
          customer_email: customerEmail,
          status: "reserved",
          reserved_at: new Date(),
          confirmed_at: null,
          released_at: null,
          metadata_json: {
            ...(normalizeRecord(input.metadata) || {}),
          },
        })

        return {
          coupon,
          redemption,
        }
      },
      {
        timeout: 20,
      }
    )
  }

  async confirmCouponForAttempt(input: ConfirmCouponForAttemptInput) {
    const locking = input.scope.resolve<ILockingModule>(Modules.LOCKING)

    return locking.execute(
      [`payment_attempt:${input.attemptId}`],
      async () => {
        const redemptions = await this.listMarketingCouponRedemptions(
          {
            payment_attempt_id: input.attemptId,
          },
          {
            take: 1,
            order: {
              created_at: "DESC",
            },
          }
        )

        const redemption = redemptions[0]

        if (!redemption) {
          return null
        }

        if (redemption.status === "confirmed") {
          return {
            coupon: await this.retrieveMarketingCoupon(redemption.coupon_id),
            redemption,
          }
        }

        if (redemption.status !== "reserved") {
          return null
        }

        const confirmedRedemption = await this.updateMarketingCouponRedemptions({
          id: redemption.id,
          status: "confirmed",
          order_id: input.orderId,
          confirmed_at: new Date(),
          released_at: null,
        })

        const coupon = await this.retrieveMarketingCoupon(redemption.coupon_id)

        await this.updateMarketingCoupons({
          id: coupon.id,
          redeemed_count: Math.max(0, Number(coupon.redeemed_count || 0)) + 1,
          ...(coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()
            ? { status: "expired" }
            : {}),
        })

        return {
          coupon,
          redemption: confirmedRedemption,
        }
      },
      {
        timeout: 20,
      }
    )
  }

  async releaseCouponForAttempt(input: ReleaseCouponForAttemptInput) {
    const locking = input.scope.resolve<ILockingModule>(Modules.LOCKING)

    return locking.execute(
      [`payment_attempt:${input.attemptId}`],
      async () => {
        const reserved = await this.listMarketingCouponRedemptions(
          {
            payment_attempt_id: input.attemptId,
            status: "reserved",
          },
          {
            take: 20,
          }
        )

        if (!reserved.length) {
          return []
        }

        const now = new Date()
        const released = [] as Array<Record<string, unknown>>

        for (const redemption of reserved) {
          const next = await this.updateMarketingCouponRedemptions({
            id: redemption.id,
            status: "released",
            released_at: now,
            metadata_json: {
              ...(normalizeRecord(redemption.metadata_json) || {}),
              release_reason: input.reason || "attempt_closed",
            },
          })

          released.push(next as Record<string, unknown>)
        }

        return released
      },
      {
        timeout: 20,
      }
    )
  }

  async resolveActiveReferralLinkByCode(code: string) {
    const normalizedCode = normalizeCode(code, "referral code")
    const links = await this.listMarketingReferralLinks(
      {
        code: normalizedCode,
      },
      {
        take: 1,
      }
    )
    const link = links[0]

    if (!link || link.status !== "active") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid referral code")
    }

    if (link.max_uses && Number(link.used_count || 0) >= link.max_uses) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Referral link has reached maximum usage"
      )
    }

    return link
  }

  async recordTouchpoint(input: RecordMarketingTouchpointInput) {
    return this.createMarketingTouchpoints({
      cart_id: toNullableText(input.cartId),
      payment_attempt_id: toNullableText(input.paymentAttemptId),
      order_id: toNullableText(input.orderId),
      customer_email: normalizeEmail(input.customerEmail),
      event_name: requireText(input.eventName, "event name"),
      coupon_code: normalizeCodeOptional(input.couponCode),
      referral_code: normalizeCodeOptional(input.referralCode),
      source: toNullableText(input.source),
      medium: toNullableText(input.medium),
      campaign: toNullableText(input.campaign),
      content: toNullableText(input.content),
      term: toNullableText(input.term),
      metadata_json: normalizeRecord(input.metadata),
    })
  }

  async listTouchpointsSafe(input?: {
    eventName?: string
    paymentAttemptId?: string
    orderId?: string
    limit?: number
  }) {
    return this.listMarketingTouchpoints(
      {
        ...(input?.eventName ? { event_name: input.eventName } : {}),
        ...(input?.paymentAttemptId
          ? { payment_attempt_id: input.paymentAttemptId }
          : {}),
        ...(input?.orderId ? { order_id: input.orderId } : {}),
      },
      {
        take: normalizeLimit(input?.limit, 100),
        order: {
          created_at: "DESC",
        },
      }
    )
  }

  async finalizeReferralReward(input: FinalizeReferralRewardInput) {
    const referral = input.resolvedContext.referral

    if (!referral?.code || !input.orderId) {
      return null
    }

    const locking = input.scope.resolve<ILockingModule>(Modules.LOCKING)

    return locking.execute(
      [`marketing_referral:${referral.code}`, `order:${input.orderId}`],
      async () => {
        const link = await this.resolveActiveReferralLinkByCode(referral.code)

        const existingRewards = await this.listMarketingReferralRewards(
          {
            referral_link_id: link.id,
            referee_order_id: input.orderId,
          },
          {
            take: 1,
          }
        )

        if (existingRewards[0]) {
          return existingRewards[0]
        }

        const linkMetadata = normalizeRecord(link.metadata_json) || {}
        const rewardType = toNullableText(linkMetadata.reward_type) || "coupon"
        const rewardValue = toNullableText(linkMetadata.reward_value)

        const reward = await this.createMarketingReferralRewards({
          referral_link_id: link.id,
          referee_order_id: input.orderId,
          referee_payment_attempt_id: input.attemptId,
          referrer_reward_type:
            rewardType === "credit" || rewardType === "commission"
              ? rewardType
              : "coupon",
          reward_value: rewardValue,
          status: "issued",
          issued_at: new Date(),
          metadata_json: {
            resolved_context: input.resolvedContext,
            customer_email: normalizeEmail(input.customerEmail),
          },
        })

        const nextUsedCount = Math.max(0, Number(link.used_count || 0)) + 1

        await this.updateMarketingReferralLinks({
          id: link.id,
          used_count: nextUsedCount,
          ...(link.max_uses && nextUsedCount >= link.max_uses
            ? { status: "disabled" }
            : {}),
        })

        return reward
      },
      {
        timeout: 20,
      }
    )
  }

  async getLatestTouchpointByAttempt(attemptId: string) {
    const touchpoints = await this.listMarketingTouchpoints(
      {
        payment_attempt_id: attemptId,
      },
      {
        take: 1,
        order: {
          created_at: "DESC",
        },
      }
    )

    return touchpoints[0] || null
  }

  private async assertCodeIsUnique(type: "campaign" | "offer" | "coupon" | "referral", code: string) {
    if (type === "campaign") {
      const existing = await this.listMarketingCampaigns({ code }, { take: 1 })
      if (existing[0]) {
        throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Campaign code already exists")
      }
      return
    }

    if (type === "offer") {
      const existing = await this.listMarketingOffers({ code }, { take: 1 })
      if (existing[0]) {
        throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Offer code already exists")
      }
      return
    }

    if (type === "coupon") {
      const existing = await this.listMarketingCoupons({ code }, { take: 1 })
      if (existing[0]) {
        throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Coupon code already exists")
      }
      return
    }

    const existing = await this.listMarketingReferralLinks({ code }, { take: 1 })
    if (existing[0]) {
      throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Referral code already exists")
    }
  }

  private async getActiveCouponByCode(code: string) {
    const coupons = await this.listMarketingCoupons(
      {
        code,
      },
      {
        take: 1,
      }
    )
    const coupon = coupons[0]

    if (!coupon || coupon.status !== "active") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid coupon code")
    }

    const now = Date.now()

    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Coupon is not active yet"
      )
    }

    if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Coupon has expired")
    }

    return coupon
  }
}

export default MarketingEngineModuleService
