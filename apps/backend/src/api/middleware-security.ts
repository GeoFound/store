import "../platform-adapters/integrations"
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../platform/runtime"
import {
  parseTenantRuntimeOptionsFromEnv,
  resolveTenantContext,
  type TenantContext,
} from "../platform/tenant"
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

type SecurityRiskLevel = "low" | "medium" | "high"

type RateLimitMiddlewareOptions = {
  action: string
  riskLevel?: SecurityRiskLevel
  keyParts?: (req: MedusaRequest) => Array<string | undefined | null>
}

export const recoverRequestRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_RECOVER_REQUEST",
  {
    id: "recover-request",
    maxRequests: 6,
    windowSeconds: 10 * 60,
    blockSeconds: 15 * 60,
  }
)

export const recoverVerifyRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_RECOVER_VERIFY",
  {
    id: "recover-verify",
    maxRequests: 20,
    windowSeconds: 10 * 60,
    blockSeconds: 15 * 60,
  }
)

export const claimOrderAccessRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_CLAIM_ORDER_ACCESS",
  {
    id: "claim-order-access",
    maxRequests: 40,
    windowSeconds: 10 * 60,
    blockSeconds: 10 * 60,
  }
)

export const createCartPaymentRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_CREATE_CART_PAYMENT",
  {
    id: "create-cart-payment",
    maxRequests: 30,
    windowSeconds: 5 * 60,
    blockSeconds: 10 * 60,
  }
)

export const paymentWebhookRateLimit = resolveRateLimitPolicyFromEnv(
  process.env,
  "SECURITY_LIMIT_PAYMENT_WEBHOOK",
  {
    id: "payment-webhook",
    maxRequests: 180,
    windowSeconds: 60,
    blockSeconds: 2 * 60,
  }
)

export const adminMutationRateLimit = resolveRateLimitPolicyFromEnv(
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
const tenantRuntimeOptions = parseTenantRuntimeOptionsFromEnv(process.env)
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

export function createSecurityHeadersMiddleware() {
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

export function createOriginGuardMiddleware(action: string) {
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

export function createRateLimitMiddleware(
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
    const tenantContext = getTenantContext(req)

    const key = buildClientFingerprint([
      tenantContext?.siteId || tenantRuntimeOptions.siteId,
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

export function createTenantContextMiddleware() {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const tenantContext = resolveTenantContext(
        {
          host: getHeaderValue(req, "x-forwarded-host") || getHeaderValue(req, "host"),
          siteIdHeader: getHeaderValue(req, "x-site-id"),
        },
        tenantRuntimeOptions
      )

      setTenantContext(req, tenantContext)
      res.setHeader("X-Site-Id", tenantContext.siteId)
      next()
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid tenant context",
        code: "invalid_tenant_context",
      })
    }
  }
}

export function getTenantContext(req: MedusaRequest) {
  return (req as MedusaRequest & { tenantContext?: TenantContext }).tenantContext
}

function setTenantContext(req: MedusaRequest, tenantContext: TenantContext) {
  const requestWithTenant = req as MedusaRequest & {
    tenantContext?: TenantContext
  }

  requestWithTenant.tenantContext = tenantContext
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

export function getRequestPath(req: MedusaRequest) {
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

export function getParamValue(req: MedusaRequest, key: string) {
  const value = (
    (req as MedusaRequest & { params?: Record<string, string | undefined> }).params ||
    {}
  )[key]
  return normalizeString(value)
}

export function normalizeString(value: unknown) {
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
