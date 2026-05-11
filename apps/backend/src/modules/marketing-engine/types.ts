import type { MedusaContainer } from "@medusajs/framework/types"
import type {
  MarketingCheckoutContextInput,
  MarketingResolvedContext,
} from "../../platform/marketing"

export type CreateMarketingCampaignInput = {
  code: string
  name: string
  description?: string | null
  status?: "draft" | "active" | "paused" | "archived"
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  budgetLimit?: number | null
  metadata?: Record<string, unknown> | null
}

export type CreateMarketingOfferInput = {
  campaignId?: string | null
  code: string
  name: string
  type?: "coupon" | "bundle" | "referral" | "upsell" | "email_flow" | "custom"
  status?: "draft" | "active" | "paused" | "archived"
  priority?: number
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  conditions?: Record<string, unknown> | null
  reward?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export type CreateMarketingCouponInput = {
  campaignId?: string | null
  offerId?: string | null
  code: string
  status?: "active" | "disabled" | "expired"
  maxRedemptions?: number | null
  maxRedemptionsPerEmail?: number | null
  startsAt?: string | Date | null
  expiresAt?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export type CreateMarketingReferralLinkInput = {
  campaignId?: string | null
  code: string
  referrerId?: string | null
  referrerEmail?: string | null
  status?: "active" | "disabled"
  maxUses?: number | null
  landingPath?: string | null
  metadata?: Record<string, unknown> | null
}

export type ReserveCouponForAttemptInput = {
  scope: MedusaContainer
  attemptId: string
  couponCode: string
  customerEmail?: string | null
  metadata?: Record<string, unknown> | null
}

export type ConfirmCouponForAttemptInput = {
  scope: MedusaContainer
  attemptId: string
  orderId: string
}

export type ReleaseCouponForAttemptInput = {
  scope: MedusaContainer
  attemptId: string
  reason?: string
}

export type ResolveCheckoutMarketingInput = {
  scope: MedusaContainer
  attemptId: string
  cartId: string
  amount: number
  currency: string
  customerEmail?: string | null
  context: MarketingCheckoutContextInput
}

export type RecordMarketingTouchpointInput = {
  cartId?: string | null
  paymentAttemptId?: string | null
  orderId?: string | null
  customerEmail?: string | null
  eventName: string
  couponCode?: string | null
  referralCode?: string | null
  source?: string | null
  medium?: string | null
  campaign?: string | null
  content?: string | null
  term?: string | null
  metadata?: Record<string, unknown> | null
}

export type FinalizeReferralRewardInput = {
  scope: MedusaContainer
  attemptId: string
  orderId: string
  customerEmail?: string | null
  resolvedContext: MarketingResolvedContext
}
