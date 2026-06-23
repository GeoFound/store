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
  createContentAITaskRunBodySchema,
  createContentAssetBodySchema,
  createContentAudioBodySchema,
  createContentEntryBodySchema,
  createContentRevisionBodySchema,
  createContentUploadPolicyBodySchema,
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
  publishContentRevisionBodySchema,
  reserveCredentialBodySchema,
  runContentAITaskBodySchema,
  sellReservationBodySchema,
  simpleLimitQuerySchema,
  storeContentSeoQuerySchema,
  suggestSeoFixesBodySchema,
  updateAfterSaleBodySchema,
  updateContentAITaskRunBodySchema,
  updateContentEntryBodySchema,
  upsertContentSeoDocumentBodySchema,
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

function adminMutationProtection(riskLevel: "medium" | "high" = "medium") {
  return [
    createRateLimitMiddleware(adminMutationRateLimit, {
      action: "security.admin_mutation.rate_limited",
      riskLevel,
      keyParts: (req) => [getRequestPath(req)],
    }),
    createOriginGuardMiddleware("security.admin_mutation.origin_blocked"),
  ]
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
        ...adminMutationProtection("medium"),
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
        ...adminMutationProtection("medium"),
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
        ...adminMutationProtection("medium"),
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
        ...adminMutationProtection("medium"),
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
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentEntryBodySchema),
      ],
    },
    {
      matcher: "/admin/content/entries/:id",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(updateContentEntryBodySchema),
      ],
    },
    {
      matcher: "/admin/content/entries/:id/revisions",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/entries/:id/revisions",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentRevisionBodySchema),
      ],
    },
    {
      matcher: "/admin/content/revisions/:id/publish",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(publishContentRevisionBodySchema),
      ],
    },
    {
      matcher: "/admin/content/assets",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/assets",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentAssetBodySchema),
      ],
    },
    {
      matcher: "/admin/content/assets/upload-policy",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentUploadPolicyBodySchema),
      ],
    },
    {
      matcher: "/admin/content/audio",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/audio",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentAudioBodySchema),
      ],
    },
    {
      matcher: "/admin/content/ai/tasks",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/ai/tasks",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createContentAITaskRunBodySchema),
      ],
    },
    {
      matcher: "/admin/content/ai/tasks/:id",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(updateContentAITaskRunBodySchema),
      ],
    },
    {
      matcher: "/admin/content/ai/run",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(runContentAITaskBodySchema),
      ],
    },
    {
      matcher: "/admin/content/seo",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/seo/audit",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/seo/performance",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/content/seo",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(upsertContentSeoDocumentBodySchema),
      ],
    },
    {
      matcher: "/admin/content/seo/suggest",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(suggestSeoFixesBodySchema),
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
        ...adminMutationProtection("medium"),
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
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(updateAfterSaleBodySchema),
      ],
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
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(createManualDeliveryBodySchema),
      ],
    },
    {
      matcher: "/admin/credential-inventory/batches",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(createCredentialBatchBodySchema),
      ],
    },
    {
      matcher: "/admin/credential-inventory/items",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(simpleLimitQuerySchema.passthrough())],
    },
    {
      matcher: "/admin/credential-inventory/reservations",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(reserveCredentialBodySchema),
      ],
    },
    {
      matcher: "/admin/credential-inventory/reservations/:reservation_key/release",
      methods: ["POST"],
      middlewares: adminMutationProtection("medium"),
    },
    {
      matcher: "/admin/credential-inventory/reservations/:reservation_key/sell",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(sellReservationBodySchema),
      ],
    },
    {
      matcher: "/admin/payment-attempts/:id/mark-paid",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(markPaymentAttemptPaidBodySchema),
      ],
    },
    {
      matcher: "/admin/payment-channels",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(createPaymentChannelBodySchema),
      ],
    },
    {
      matcher: "/admin/payment-channels/:id",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("high"),
        validateAndTransformBody(updatePaymentChannelBodySchema),
      ],
    },
    {
      matcher: "/admin/suppliers/mappings",
      methods: ["POST"],
      middlewares: [
        ...adminMutationProtection("medium"),
        validateAndTransformBody(upsertSupplierMappingBodySchema),
      ],
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
      matcher: "/store/content/seo",
      methods: ["GET"],
      middlewares: [validateAndTransformSimpleQuery(storeContentSeoQuerySchema)],
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
