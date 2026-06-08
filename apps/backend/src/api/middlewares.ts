import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  authenticate,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ZodError, type ZodTypeAny } from "zod"
import { ensurePlatformIntegrationsRegistered } from "../platform-adapters/integrations"
import {
  analyticsDispatchesQuerySchema,
  analyticsEventsQuerySchema,
  claimOrderAccessBodySchema,
  contentEntriesQuerySchema,
  createContentEntryBodySchema,
  createAfterSaleBodySchema,
  createCartPaymentBodySchema,
  createCredentialBatchBodySchema,
  createManualDeliveryBodySchema,
  createMarketingCampaignBodySchema,
  createMarketingCouponBodySchema,
  createMarketingOfferBodySchema,
  createMarketingReferralLinkBodySchema,
  createPaymentChannelBodySchema,
  manualPaymentWebhookSchema,
  markPaymentAttemptPaidBodySchema,
  paymentAttemptsQuerySchema,
  paymentMethodsQuerySchema,
  paymentWebhookSchema,
  productAvailabilityQuerySchema,
  recoverOrderBodySchema,
  replayAnalyticsDispatchBodySchema,
  reserveCredentialBodySchema,
  sellReservationBodySchema,
  simpleLimitQuerySchema,
  updateAfterSaleBodySchema,
  updateContentEntryBodySchema,
  updatePaymentChannelBodySchema,
  upsertSupplierMappingBodySchema,
  verifyRecoverBodySchema,
} from "./middleware-schemas"
import {
  adminMutationRateLimit,
  claimOrderAccessRateLimit,
  createCartPaymentRateLimit,
  createOriginGuardMiddleware,
  createRateLimitMiddleware,
  createSecurityHeadersMiddleware,
  createTenantContextMiddleware,
  getParamValue,
  getRequestPath,
  normalizeString,
  paymentWebhookRateLimit,
  recoverRequestRateLimit,
  recoverVerifyRateLimit,
} from "./middleware-security"

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

function getBodyValue(req: MedusaRequest, key: string) {
  const body = (
    ((req as MedusaRequest & { validatedBody?: Record<string, unknown> }).validatedBody ||
      req.body ||
      {}) as Record<string, unknown>
  )[key]

  if (Array.isArray(body)) {
    return normalizeString(body[0])
  }

  if (typeof body === "number" || typeof body === "boolean") {
    return String(body)
  }

  return normalizeString(body)
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
        createTenantContextMiddleware(),
        createSecurityHeadersMiddleware(),
      ],
    },
    {
      matcher: "/hooks/payment/:provider_code",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [
        createRateLimitMiddleware(paymentWebhookRateLimit, {
          action: "security.payment_webhook.rate_limited",
          riskLevel: "high",
          keyParts: (req) => [getParamValue(req, "provider_code")],
        }),
        validateAndTransformBody(paymentWebhookSchema.passthrough()),
      ],
    },
    {
      matcher: "/hooks/payment/manual",
      methods: ["POST"],
      bodyParser: {
        preserveRawBody: true,
      },
      middlewares: [
        createRateLimitMiddleware(paymentWebhookRateLimit, {
          action: "security.manual_webhook.rate_limited",
          riskLevel: "high",
          keyParts: () => ["manual"],
        }),
        validateAndTransformBody(manualPaymentWebhookSchema.passthrough()),
      ],
    },
    {
      matcher: "/store/payment-methods",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(paymentMethodsQuerySchema)],
    },
    {
      matcher: "/store/account/orders",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
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
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(createMarketingCampaignBodySchema),
      ],
    },
    {
      matcher: "/admin/marketing/offers",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/offers",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(createMarketingOfferBodySchema),
      ],
    },
    {
      matcher: "/admin/marketing/coupons",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/coupons",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(createMarketingCouponBodySchema),
      ],
    },
    {
      matcher: "/admin/marketing/referral-links",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/marketing/referral-links",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(createMarketingReferralLinkBodySchema),
      ],
    },
    {
      matcher: "/admin/marketing/touchpoints",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/entries",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(contentEntriesQuerySchema)],
    },
    {
      matcher: "/admin/content/entries",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(createContentEntryBodySchema),
      ],
    },
    {
      matcher: "/admin/content/entries/:id",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(updateContentEntryBodySchema),
      ],
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
      middlewares: [
        createRateLimitMiddleware(adminMutationRateLimit, {
          action: "security.admin_mutation.rate_limited",
          riskLevel: "medium",
          keyParts: (req) => [getRequestPath(req)],
        }),
        createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
        validateAndTransformBody(replayAnalyticsDispatchBodySchema),
      ],
    },
    {
      matcher: "/admin/after-sales",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/after-sales/:id",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(updateAfterSaleBodySchema)],
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
      matcher: "/admin/digital-delivery/deliveries",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createManualDeliveryBodySchema)],
    },
    {
      matcher: "/admin/credential-inventory/batches",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createCredentialBatchBodySchema)],
    },
    {
      matcher: "/admin/credential-inventory/items",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/credential-inventory/reservations",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(reserveCredentialBodySchema)],
    },
    {
      matcher: "/admin/credential-inventory/reservations/:reservation_key/sell",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(sellReservationBodySchema)],
    },
    {
      matcher: "/admin/payment-attempts/:id/mark-paid",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(markPaymentAttemptPaidBodySchema)],
    },
    {
      matcher: "/admin/payment-channels",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createPaymentChannelBodySchema)],
    },
    {
      matcher: "/admin/payment-channels/:id",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(updatePaymentChannelBodySchema)],
    },
    {
      matcher: "/admin/suppliers/mappings",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(upsertSupplierMappingBodySchema)],
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
      matcher: "/store/content/entries",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(contentEntriesQuerySchema)],
    },
    {
      matcher: "/store/content/entries/:slug",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(contentEntriesQuerySchema)],
    },
    {
      matcher: "/store/deliveries/:access_token/after-sales",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createAfterSaleBodySchema)],
    },
    {
      matcher: "/store/order-access/:access_token/deliveries/:delivery_id/after-sales",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(createAfterSaleBodySchema)],
    },
    {
      matcher: "/store/orders/recover",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(recoverRequestRateLimit, {
          action: "security.order_recover.rate_limited",
          riskLevel: "high",
          keyParts: (req) => [getBodyValue(req, "email"), getBodyValue(req, "order_id")],
        }),
        createOriginGuardMiddleware("security.order_recover.origin_blocked"),
        validateAndTransformBody(recoverOrderBodySchema),
      ],
    },
    {
      matcher: "/store/orders/recover/verify",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(recoverVerifyRateLimit, {
          action: "security.order_recover_verify.rate_limited",
          riskLevel: "high",
          keyParts: (req) => [getBodyValue(req, "order_id")],
        }),
        createOriginGuardMiddleware("security.order_recover_verify.origin_blocked"),
        validateAndTransformBody(verifyRecoverBodySchema),
      ],
    },
    {
      matcher: "/store/payment-attempts/:id/claim-order-access",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(claimOrderAccessRateLimit, {
          action: "security.claim_order_access.rate_limited",
          riskLevel: "high",
          keyParts: (req) => [getParamValue(req, "id"), getBodyValue(req, "claim_token")],
        }),
        createOriginGuardMiddleware("security.claim_order_access.origin_blocked"),
        validateAndTransformBody(claimOrderAccessBodySchema),
      ],
    },
    {
      matcher: "/store/carts/:cart_id/payments",
      methods: ["POST"],
      middlewares: [
        createRateLimitMiddleware(createCartPaymentRateLimit, {
          action: "security.create_cart_payment.rate_limited",
          riskLevel: "high",
          keyParts: (req) => [
            getParamValue(req, "cart_id"),
            getBodyValue(req, "payment_method"),
          ],
        }),
        createOriginGuardMiddleware("security.create_cart_payment.origin_blocked"),
        validateAndTransformBody(createCartPaymentBodySchema),
      ],
    },
  ],
})
