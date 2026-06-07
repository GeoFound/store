import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z, ZodError, type ZodTypeAny } from "zod"
import { ensurePlatformIntegrationsRegistered } from "../platform-adapters/integrations"
import { isPlatformPluginEnabled } from "../platform/runtime"
import { emitAuditLog } from "../utils/audit-log"
import { localizedMessage } from "../utils/localized-response"
import { getRequestAuditContext } from "../utils/request-audit"
import {
  type RateLimitPolicy,
  assertRateLimitStoreIsSafeForRuntime,
  evaluateRateLimitWithStore,
  type RateLimitDecision,
  resolveRateLimitPolicyFromEnv,
} from "../utils/security-rate-limit"
import {
  buildClientFingerprint,
  parseAllowedOriginsFromEnv,
  resolveRequestIp,
  resolveRequestOrigin,
} from "../utils/security-request"

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
  payment_method: z.string().trim().min(1),
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

const recoverRequestRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_RECOVER_REQUEST",
  {
    id: "recover-request",
    maxRequests: 6,
    windowSeconds: 10 * 60,
    blockSeconds: 15 * 60,
  }
)

const recoverVerifyRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_RECOVER_VERIFY",
  {
    id: "recover-verify",
    maxRequests: 20,
    windowSeconds: 10 * 60,
    blockSeconds: 15 * 60,
  }
)

const claimOrderAccessRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_CLAIM_ORDER_ACCESS",
  {
    id: "claim-order-access",
    maxRequests: 40,
    windowSeconds: 10 * 60,
    blockSeconds: 10 * 60,
  }
)

const createCartPaymentRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_CREATE_CART_PAYMENT",
  {
    id: "create-cart-payment",
    maxRequests: 30,
    windowSeconds: 5 * 60,
    blockSeconds: 10 * 60,
  }
)

const paymentWebhookRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_PAYMENT_WEBHOOK",
  {
    id: "payment-webhook",
    maxRequests: 180,
    windowSeconds: 60,
    blockSeconds: 2 * 60,
  }
)

const adminMutationRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_ADMIN_MUTATION",
  {
    id: "admin-mutation",
    maxRequests: 120,
    windowSeconds: 60,
    blockSeconds: 2 * 60,
  }
)

const SECURITY_GUARD_PLUGIN_ID = "security-guard"
const securityAllowedOrigins = parseAllowedOriginsFromEnv(process.env)
const securityHeadersEnabled = parseBooleanFlag(
  process.env.SECURITY_HEADERS_ENABLED,
  true
)
const securityOriginEnforcementEnabled = parseBooleanFlag(
  process.env.SECURITY_ENFORCE_ORIGIN_CHECKS,
  true
)
const securityHstsMaxAgeSeconds = parseNonNegativeInt(
  process.env.SECURITY_HSTS_MAX_AGE_SECONDS
)
const securityHstsIncludeSubdomains = parseBooleanFlag(
  process.env.SECURITY_HSTS_INCLUDE_SUBDOMAINS,
  true
)
const securityHstsPreload = parseBooleanFlag(
  process.env.SECURITY_HSTS_PRELOAD,
  false
)

if (isSecurityGuardEnabled()) {
  assertRateLimitStoreIsSafeForRuntime(process.env)
}

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

type SecurityRiskLevel = "low" | "medium" | "high"

type RateLimitMiddlewareOptions = {
  action: string
  riskLevel?: SecurityRiskLevel
  keyParts?: (req: MedusaRequest) => Array<string | undefined | null>
}

function createSecurityHeadersMiddleware() {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    if (!securityHeadersEnabled || !isSecurityGuardEnabled()) {
      next()
      return
    }

    setHeaderIfMissing(res, "X-Content-Type-Options", "nosniff")
    setHeaderIfMissing(res, "X-Frame-Options", "DENY")
    setHeaderIfMissing(res, "Referrer-Policy", "strict-origin-when-cross-origin")
    setHeaderIfMissing(
      res,
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    )
    setHeaderIfMissing(res, "X-DNS-Prefetch-Control", "off")

    if (isHttpsRequest(req) && securityHstsMaxAgeSeconds > 0) {
      const hstsSegments = [`max-age=${securityHstsMaxAgeSeconds}`]

      if (securityHstsIncludeSubdomains) {
        hstsSegments.push("includeSubDomains")
      }

      if (securityHstsPreload) {
        hstsSegments.push("preload")
      }

      setHeaderIfMissing(res, "Strict-Transport-Security", hstsSegments.join("; "))
    }

    next()
  }
}

function createOriginGuardMiddleware(action: string) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    if (
      !securityOriginEnforcementEnabled ||
      !securityAllowedOrigins.length ||
      !isSecurityGuardEnabled()
    ) {
      next()
      return
    }

    const originHeader = getHeaderValue(req, "origin")
    const refererHeader = getHeaderValue(req, "referer")

    if (!originHeader && !refererHeader) {
      // Non-browser/API clients are allowed when no browser origin signal exists.
      next()
      return
    }

    const resolvedOrigin = resolveRequestOrigin(req)

    if (resolvedOrigin && securityAllowedOrigins.includes(resolvedOrigin)) {
      next()
      return
    }

    await emitSecurityGuardAuditLog(req, {
      action,
      riskLevel: "high",
      metadata: {
        reason: "origin_not_allowed",
        request_origin: resolvedOrigin || null,
        origin_header: originHeader || null,
        referer_header: refererHeader || null,
        allowed_origins: securityAllowedOrigins,
        request_path: getRequestPath(req),
        request_method: getRequestMethod(req),
      },
    })

    res.status(403).json({
      message: localizedMessage(req, "security.originNotAllowed"),
      code: "origin_not_allowed",
    })
  }
}

function createRateLimitMiddleware(
  policy: RateLimitPolicy,
  options: RateLimitMiddlewareOptions
) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    if (!isSecurityGuardEnabled()) {
      next()
      return
    }

    const requestPath = getRequestPath(req)
    const requestMethod = getRequestMethod(req)
    const requestOrigin = resolveRequestOrigin(req)
    const requestIp = resolveRequestIp(req)
    const userAgent = getRequestAuditContext(req).userAgent
    const customKeyParts = options.keyParts?.(req) || []

    const key = buildClientFingerprint([
      policy.id,
      requestPath,
      requestMethod,
      requestOrigin,
      requestIp,
      userAgent,
      ...customKeyParts,
    ])
    let decision: RateLimitDecision

    try {
      decision = await evaluateRateLimitWithStore(policy, key)
    } catch (error) {
      await emitSecurityGuardAuditLog(req, {
        action: options.action,
        riskLevel: "high",
        metadata: {
          reason: "rate_limit_store_unavailable",
          policy_id: policy.id,
          request_path: requestPath,
          request_method: requestMethod,
          request_origin: requestOrigin || null,
          error: error instanceof Error ? error.message : String(error),
        },
      })

      res.status(503).json({
        message: "Rate limit store is unavailable",
        code: "rate_limit_store_unavailable",
      })
      return
    }

    setRateLimitHeaders(res, decision)

    if (decision.allowed) {
      next()
      return
    }

    if (decision.retryAfterSeconds > 0) {
      res.setHeader("Retry-After", String(decision.retryAfterSeconds))
    }

    await emitSecurityGuardAuditLog(req, {
      action: options.action,
      riskLevel: options.riskLevel || "high",
      metadata: {
        reason: "rate_limited",
        policy_id: policy.id,
        request_path: requestPath,
        request_method: requestMethod,
        request_origin: requestOrigin || null,
        retry_after_seconds: decision.retryAfterSeconds,
        rate_limit: decision.limit,
      },
    })

    res.status(429).json({
      message: localizedMessage(req, "security.tooManyRequests"),
      code: "rate_limited",
      retry_after_seconds: decision.retryAfterSeconds,
    })
  }
}

async function emitSecurityGuardAuditLog(
  req: MedusaRequest,
  input: {
    action: string
    riskLevel: SecurityRiskLevel
    metadata?: Record<string, unknown>
  }
) {
  try {
    const context = getRequestAuditContext(req)

    await emitAuditLog(req.scope, {
      actorType: resolveAuditActorType(req),
      actorId: context.actorId,
      action: input.action,
      entityType: "security",
      riskLevel: input.riskLevel,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: input.metadata,
    })
  } catch {
    // Security audit logging is best-effort and must not block request flow.
  }
}

function resolveAuditActorType(req: MedusaRequest) {
  const authContext = (
    req as MedusaRequest & {
      auth_context?: {
        actor_type?: string
      }
    }
  ).auth_context
  const actorType = normalizeString(authContext?.actor_type)
  const path = getRequestPath(req)

  if (actorType === "admin") {
    return "admin" as const
  }

  if (actorType === "customer") {
    return "customer" as const
  }

  if (path.startsWith("/hooks/")) {
    return "webhook" as const
  }

  if (path.startsWith("/admin/")) {
    return "admin" as const
  }

  return "guest" as const
}

function isSecurityGuardEnabled() {
  return isPlatformPluginEnabled(SECURITY_GUARD_PLUGIN_ID)
}

function isHttpsRequest(req: MedusaRequest) {
  const forwardedProto = normalizeString(getHeaderValue(req, "x-forwarded-proto"))

  if (forwardedProto.split(",").map((entry) => entry.trim()).includes("https")) {
    return true
  }

  const requestWithProtocol = req as MedusaRequest & {
    protocol?: string
    secure?: boolean
  }

  if (requestWithProtocol.secure === true) {
    return true
  }

  return normalizeString(requestWithProtocol.protocol) === "https"
}

function setRateLimitHeaders(res: MedusaResponse, decision: RateLimitDecision) {
  const resetAtMs = Date.parse(decision.resetAt)
  const resetAfterSeconds = Number.isFinite(resetAtMs)
    ? Math.max(0, Math.ceil((resetAtMs - Date.now()) / 1000))
    : Math.max(0, decision.retryAfterSeconds)

  res.setHeader("X-RateLimit-Limit", String(decision.limit))
  res.setHeader("X-RateLimit-Remaining", String(decision.remaining))
  res.setHeader("X-RateLimit-Reset", String(resetAfterSeconds))
}

function setHeaderIfMissing(res: MedusaResponse, name: string, value: string) {
  if (!res.getHeader(name)) {
    res.setHeader(name, value)
  }
}

function getHeaderValue(req: MedusaRequest, headerName: string) {
  const value = req.headers[headerName] ?? req.headers[headerName.toLowerCase()]

  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === "string" ? value : ""
}

function getRequestPath(req: MedusaRequest) {
  const requestWithPath = req as MedusaRequest & {
    originalUrl?: string
    path?: string
    url?: string
  }

  return (
    normalizeString(requestWithPath.originalUrl) ||
    normalizeString(requestWithPath.path) ||
    normalizeString(requestWithPath.url) ||
    "/"
  )
}

function getRequestMethod(req: MedusaRequest) {
  return normalizeString(
    (req as MedusaRequest & { method?: string }).method
  ).toUpperCase()
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

function getParamValue(req: MedusaRequest, key: string) {
  const value = (
    (req as MedusaRequest & { params?: Record<string, string | undefined> }).params ||
    {}
  )[key]
  return normalizeString(value)
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = normalizeString(value).toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function parseNonNegativeInt(value: string | undefined) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
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
