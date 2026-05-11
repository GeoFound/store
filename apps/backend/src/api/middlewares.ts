import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z, ZodError, type ZodTypeAny } from "zod"
import { ensurePlatformIntegrationsRegistered } from "../platform/integrations"

const limitSchema = z.coerce.number().int().min(1).max(200).optional()

const paymentMethodsQuerySchema = z.object({
  amount: z.coerce.number().nonnegative().optional(),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3}$/)
    .optional(),
})

const paymentAttemptsQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  cart_id: z.string().trim().min(1).optional(),
  provider_code: z.string().trim().min(1).optional(),
  limit: limitSchema,
})

const simpleLimitQuerySchema = z.object({
  limit: limitSchema,
})

const productAvailabilityQuerySchema = z.object({
  variant_ids: z.union([z.string(), z.array(z.string())]).optional(),
})

const recoverOrderBodySchema = z.object({
  email: z.string().trim().email(),
  order_id: z.string().trim().min(1),
})

const verifyRecoverBodySchema = z.object({
  order_id: z.string().trim().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
})

const claimOrderAccessBodySchema = z.object({
  claim_token: z.string().trim().min(16),
})

const createCartPaymentBodySchema = z.object({
  payment_method: z.string().trim().optional(),
  marketing: z
    .object({
      coupon_code: z.string().trim().max(64).optional(),
      referral_code: z.string().trim().max(64).optional(),
      utm_source: z.string().trim().max(160).optional(),
      utm_medium: z.string().trim().max(160).optional(),
      utm_campaign: z.string().trim().max(160).optional(),
      utm_content: z.string().trim().max(160).optional(),
      utm_term: z.string().trim().max(160).optional(),
    })
    .optional(),
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

const createMarketingCampaignBodySchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  budget_limit: z.coerce.number().int().min(0).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const createMarketingOfferBodySchema = z.object({
  campaign_id: z.string().trim().min(1).nullable().optional(),
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  type: z
    .enum(["coupon", "bundle", "referral", "upsell", "email_flow", "custom"])
    .optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  priority: z.coerce.number().int().min(-1000).max(10000).optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  reward: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const createMarketingCouponBodySchema = z.object({
  campaign_id: z.string().trim().min(1).nullable().optional(),
  offer_id: z.string().trim().min(1).nullable().optional(),
  code: z.string().trim().min(2).max(64),
  status: z.enum(["active", "disabled", "expired"]).optional(),
  max_redemptions: z.coerce.number().int().min(1).nullable().optional(),
  max_redemptions_per_email: z.coerce.number().int().min(1).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const createMarketingReferralLinkBodySchema = z.object({
  campaign_id: z.string().trim().min(1).nullable().optional(),
  code: z.string().trim().min(2).max(64),
  referrer_id: z.string().trim().min(1).nullable().optional(),
  referrer_email: z.string().trim().email().nullable().optional(),
  status: z.enum(["active", "disabled"]).optional(),
  max_uses: z.coerce.number().int().min(1).nullable().optional(),
  landing_path: z.string().trim().max(500).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

const analyticsEventsQuerySchema = z.object({
  event_name: z.string().trim().min(1).optional(),
  source: z.enum(["backend_hook", "storefront", "system"]).optional(),
  status: z.enum(["pending", "processing", "delivered", "failed", "partial"]).optional(),
  destination_code: z.string().trim().min(1).optional(),
  order_id: z.string().trim().min(1).optional(),
  payment_attempt_id: z.string().trim().min(1).optional(),
  limit: limitSchema,
})

const analyticsDispatchesQuerySchema = z.object({
  destination_code: z.string().trim().min(1).optional(),
  status: z.enum(["pending", "processing", "delivered", "failed", "dead"]).optional(),
  event_id: z.string().trim().min(1).optional(),
  limit: limitSchema,
})

const replayAnalyticsDispatchBodySchema = z.object({
  dispatch_id: z.string().trim().min(1),
})

const paymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.enum(["paid", "failed", "expired"]),
})

const manualPaymentWebhookSchema = z.object({
  provider_order_id: z.string().trim().min(1),
  status: z.literal("paid"),
})

function validateAndTransformSimpleQuery(schema: ZodTypeAny) {
  return (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    try {
      req.validatedQuery = schema.parse(req.query) as Record<string, unknown>
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new MedusaError(
            MedusaError.Types.INVALID_DATA,
            error.issues.map((issue) => issue.message).join(", ")
          )
        )
        return
      }

      next(error)
    }
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: /.*/,
      middlewares: [
        (
          _req: MedusaRequest,
          _res: MedusaResponse,
          next: MedusaNextFunction
        ) => {
          ensurePlatformIntegrationsRegistered()
          next()
        },
      ],
    },
    {
      matcher: "/hooks/payment/:provider_code",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [validateAndTransformBody(paymentWebhookSchema.passthrough())],
    },
    {
      matcher: "/hooks/payment/manual",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [validateAndTransformBody(manualPaymentWebhookSchema.passthrough())],
    },
    {
      matcher: "/store/payment-methods",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(paymentMethodsQuerySchema)],
    },
    {
      matcher: "/admin/payment-attempts",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(paymentAttemptsQuerySchema)],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/campaigns",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createMarketingCampaignBodySchema)],
    },
    {
      matcher: "/admin/marketing/offers",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/offers",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createMarketingOfferBodySchema)],
    },
    {
      matcher: "/admin/marketing/coupons",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/coupons",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createMarketingCouponBodySchema)],
    },
    {
      matcher: "/admin/marketing/referral-links",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/referral-links",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createMarketingReferralLinkBodySchema)],
    },
    {
      matcher: "/admin/marketing/touchpoints",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/analytics/events",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(analyticsEventsQuerySchema)],
    },
    {
      matcher: "/admin/analytics/dispatches",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(analyticsDispatchesQuerySchema)],
    },
    {
      matcher: "/admin/analytics/dispatches",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(replayAnalyticsDispatchBodySchema)],
    },
    {
      matcher: "/admin/after-sales",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/audit-logs",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/digital-delivery/pending",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/digital-delivery/deliveries",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/credential-inventory/items",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/store/product-availability",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(productAvailabilityQuerySchema)],
    },
    {
      matcher: "/store/marketing/campaigns",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/store/orders/recover",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(recoverOrderBodySchema)],
    },
    {
      matcher: "/store/orders/recover/verify",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(verifyRecoverBodySchema)],
    },
    {
      matcher: "/store/payment-attempts/:id/claim-order-access",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(claimOrderAccessBodySchema)],
    },
    {
      matcher: "/store/carts/:cart_id/payments",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createCartPaymentBodySchema)],
    },
  ],
})
