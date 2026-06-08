import { z } from "zod"

const limitSchema = z.coerce.number().int().min(1).max(200).optional()
const nullableRecordSchema = z.record(z.string(), z.unknown()).nullable().optional()
const optionalRecordSchema = z.record(z.string(), z.unknown()).optional()
const optionalTextSchema = z.string().trim().optional()
const nullableTextSchema = z.string().trim().nullable().optional()
const moneySchema = z.coerce.number().optional()
const nullableMoneySchema = z.coerce.number().nullable().optional()

export const paymentMethodsQuerySchema = z.object({
  amount: z.coerce.number().nonnegative().optional(),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/)
    .optional(),
})

export const paymentAttemptsQuerySchema = z.object({
  status: optionalTextSchema,
  cart_id: optionalTextSchema,
  provider_code: optionalTextSchema,
  limit: limitSchema,
})

export const simpleLimitQuerySchema = z.object({
  limit: limitSchema,
})

export const productAvailabilityQuerySchema = z.object({
  variant_ids: z.union([z.string(), z.array(z.string())]).optional(),
})

export const recoverOrderBodySchema = z.object({
  email: z.string().trim().email(),
  order_id: z.string().trim().min(1),
})

export const verifyRecoverBodySchema = z.object({
  order_id: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
})

export const claimOrderAccessBodySchema = z.object({
  claim_token: z.string().trim().min(16),
})

const marketingContextSchema = z
  .object({
    coupon_code: optionalTextSchema,
    referral_code: optionalTextSchema,
    utm_source: optionalTextSchema,
    utm_medium: optionalTextSchema,
    utm_campaign: optionalTextSchema,
    utm_content: optionalTextSchema,
    utm_term: optionalTextSchema,
  })
  .optional()

export const createCartPaymentBodySchema = z.object({
  payment_method: z.string().trim().min(1),
  marketing: marketingContextSchema,
  analytics: z
    .object({
      ga_client_id: z.string().trim().max(128).optional(),
      ga_session_id: z.string().trim().max(128).optional(),
      page_location: z.string().trim().max(2000).optional(),
      page_path: z.string().trim().max(500).optional(),
      referrer: z.string().trim().max(2000).optional(),
    })
    .optional(),
})

export const createMarketingCampaignBodySchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  budget_limit: z.coerce.number().int().min(0).nullable().optional(),
  metadata: nullableRecordSchema,
})

export const createMarketingOfferBodySchema = z.object({
  campaign_id: nullableTextSchema,
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  type: z
    .enum(["coupon", "bundle", "referral", "upsell", "email_flow", "custom"])
    .optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  priority: z.coerce.number().int().min(-1000).max(10000).optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  conditions: nullableRecordSchema,
  reward: nullableRecordSchema,
  metadata: nullableRecordSchema,
})

export const createMarketingCouponBodySchema = z.object({
  campaign_id: nullableTextSchema,
  offer_id: nullableTextSchema,
  code: z.string().trim().min(2).max(64),
  status: z.enum(["active", "disabled", "expired"]).optional(),
  max_redemptions: z.coerce.number().int().min(1).nullable().optional(),
  max_redemptions_per_email: z.coerce.number().int().min(1).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: nullableRecordSchema,
})

export const createMarketingReferralLinkBodySchema = z.object({
  campaign_id: nullableTextSchema,
  code: z.string().trim().min(2).max(64),
  referrer_id: nullableTextSchema,
  referrer_email: z.string().trim().email().nullable().optional(),
  status: z.enum(["active", "disabled"]).optional(),
  max_uses: z.coerce.number().int().min(1).nullable().optional(),
  landing_path: z.string().trim().max(500).nullable().optional(),
  metadata: nullableRecordSchema,
})

const contentTypeSchema = z.enum([
  "article",
  "guide",
  "report",
  "review",
  "resource",
  "case_study",
])
const contentStatusSchema = z.enum(["draft", "review", "published", "archived"])
const contentStringListSchema = z
  .union([z.string(), z.array(z.string().trim().min(1))])
  .nullable()
  .optional()

export const contentEntriesQuerySchema = z.object({
  site_id: optionalTextSchema,
  status: contentStatusSchema.optional(),
  content_type: contentTypeSchema.optional(),
  topic: optionalTextSchema,
  tag: optionalTextSchema,
  limit: limitSchema,
})

export const createContentEntryBodySchema = z.object({
  site_id: optionalTextSchema,
  slug: z.string().trim().min(2).max(140),
  title: z.string().trim().min(1).max(240),
  excerpt: z.string().trim().max(1000).nullable().optional(),
  body: z.string().trim().max(100000).nullable().optional(),
  content_type: contentTypeSchema.optional(),
  status: contentStatusSchema.optional(),
  author_name: z.string().trim().max(120).nullable().optional(),
  cover_image_url: z.string().trim().max(2000).nullable().optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  tags: contentStringListSchema,
  seo: nullableRecordSchema,
  source_refs: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
  related_product_handles: contentStringListSchema,
  ai_assisted: z.boolean().optional(),
  published_at: z.string().datetime().nullable().optional(),
  metadata: nullableRecordSchema,
})

export const updateContentEntryBodySchema = createContentEntryBodySchema
  .partial()
  .omit({ slug: true, title: true })
  .extend({
    slug: z.string().trim().min(2).max(140).optional(),
    title: z.string().trim().min(1).max(240).optional(),
  })

export const analyticsEventsQuerySchema = z.object({
  event_name: optionalTextSchema,
  source: z.enum(["backend_hook", "storefront", "system"]).optional(),
  status: z.enum(["pending", "processing", "delivered", "failed", "partial"]).optional(),
  destination_code: optionalTextSchema,
  order_id: optionalTextSchema,
  payment_attempt_id: optionalTextSchema,
  limit: limitSchema,
})

export const analyticsDispatchesQuerySchema = z.object({
  destination_code: optionalTextSchema,
  status: z.enum(["pending", "processing", "delivered", "failed", "dead"]).optional(),
  event_id: optionalTextSchema,
  limit: limitSchema,
})

export const replayAnalyticsDispatchBodySchema = z.object({
  dispatch_id: z.string().trim().min(1),
})

export const paymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.enum(["paid", "failed", "expired"]),
})

export const manualPaymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.literal("paid"),
})

export const updateAfterSaleBodySchema = z.object({
  status: z.enum(["open", "processing", "resolved", "rejected", "closed"]).optional(),
  result: z.enum(["pending", "replaced", "refunded", "rejected", "resolved"]).optional(),
  admin_note: optionalTextSchema,
})

const credentialItemSchema = z.object({
  credential: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  account_identifier: optionalTextSchema,
  display_label: optionalTextSchema,
  source_note: optionalTextSchema,
  cost_price: moneySchema,
  currency: optionalTextSchema,
  metadata: optionalRecordSchema,
})

export const createCredentialBatchBodySchema = z.object({
  name: optionalTextSchema,
  product_variant_id: optionalTextSchema,
  template_code: optionalTextSchema,
  source_note: optionalTextSchema,
  cost_price: moneySchema,
  currency: optionalTextSchema,
  metadata: optionalRecordSchema,
  items: z.array(credentialItemSchema).optional(),
})

export const reserveCredentialBodySchema = z.object({
  product_variant_id: optionalTextSchema,
  quantity: z.coerce.number().int().min(1).optional(),
  reservation_key: optionalTextSchema,
  cart_id: optionalTextSchema,
  order_id: optionalTextSchema,
  ttl_seconds: z.coerce.number().int().min(1).optional(),
})

export const sellReservationBodySchema = z.object({
  order_id: optionalTextSchema,
})

export const createManualDeliveryBodySchema = z.object({
  delivery_id: optionalTextSchema,
  order_id: optionalTextSchema,
  cart_id: optionalTextSchema,
  payment_attempt_id: optionalTextSchema,
  order_item_id: optionalTextSchema,
  account_item_id: optionalTextSchema,
  delivery_payload: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  delivery_status: z.enum(["pending", "delivered"]).optional(),
  delivered_by: optionalTextSchema,
  delivery_note: optionalTextSchema,
  metadata: optionalRecordSchema,
})

export const markPaymentAttemptPaidBodySchema = z.object({
  note: optionalTextSchema,
})

const channelTypeSchema = z.enum(["manual", "aggregate_cn", "crypto"])
const channelHealthSchema = z.enum(["healthy", "degraded", "down"])

export const createPaymentChannelBodySchema = z.object({
  code: optionalTextSchema,
  name: optionalTextSchema,
  display_name: optionalTextSchema,
  type: channelTypeSchema.optional(),
  enabled: z.boolean().optional(),
  priority: z.coerce.number().optional(),
  min_amount: moneySchema,
  max_amount: moneySchema,
  currency: optionalTextSchema,
  provider_code: optionalTextSchema,
  health_status: channelHealthSchema.optional(),
  config_json: optionalRecordSchema,
})

export const updatePaymentChannelBodySchema = z.object({
  display_name: optionalTextSchema,
  enabled: z.boolean().optional(),
  priority: z.coerce.number().optional(),
  min_amount: nullableMoneySchema,
  max_amount: nullableMoneySchema,
  currency: nullableTextSchema,
  health_status: channelHealthSchema.optional(),
  config_json: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const upsertSupplierMappingBodySchema = z.object({
  product_variant_id: optionalTextSchema,
  provider_code: optionalTextSchema,
  provider_sku: optionalTextSchema,
  provider_product_id: nullableTextSchema,
  provider_variant_id: nullableTextSchema,
  region_code: nullableTextSchema,
  currency: nullableTextSchema,
  enabled: z.boolean().optional(),
  priority: z.coerce.number().optional(),
  cost_price: nullableMoneySchema,
  list_price: nullableMoneySchema,
  metadata: nullableRecordSchema,
})

export const createAfterSaleBodySchema = z.object({
  email: z.string().trim().email().optional(),
  reason: z
    .enum(["not_working", "wrong_item", "duplicate", "refund", "other"])
    .optional(),
  message: optionalTextSchema,
})
