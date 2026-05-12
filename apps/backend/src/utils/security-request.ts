import crypto from "crypto"
import type { MedusaRequest } from "@medusajs/framework/http"

const LOOPBACK_V6 = "::1"
const LOOPBACK_V4 = "127.0.0.1"
const IPV4_MAPPED_PREFIX = "::ffff:"

export function shouldTrustProxyHeaders(
  env: Record<string, string | undefined> = process.env
) {
  const value = toOptionalString(env.SECURITY_TRUST_PROXY_HEADERS).toLowerCase()
  return ["1", "true", "yes", "on"].includes(value)
}

export function resolveRequestIp(
  req: MedusaRequest,
  env: Record<string, string | undefined> = process.env
) {
  const trustProxyHeaders = shouldTrustProxyHeaders(env)

  if (trustProxyHeaders) {
    const forwardedFor = getHeader(req, "x-forwarded-for")
    const parsedForwardedFor = parseForwardedForHeader(forwardedFor)

    if (parsedForwardedFor) {
      return parsedForwardedFor
    }

    const realIp = normalizeIpCandidate(getHeader(req, "x-real-ip"))

    if (realIp) {
      return realIp
    }
  }

  const socketAddress = normalizeIpCandidate(
    (req as MedusaRequest & { socket?: { remoteAddress?: string } }).socket
      ?.remoteAddress
  )

  if (socketAddress) {
    return socketAddress
  }

  return LOOPBACK_V4
}

export function parseAllowedOriginsFromEnv(
  env: Record<string, string | undefined> = process.env
) {
  return Array.from(
    new Set(
      [
        env.STORE_CORS,
        env.ADMIN_CORS,
        env.AUTH_CORS,
        env.SECURITY_ALLOWED_ORIGINS,
      ]
        .flatMap((value) =>
          String(value || "")
            .split(",")
            .map((entry) => normalizeOrigin(entry))
            .filter(Boolean)
        )
    )
  )
}

export function resolveRequestOrigin(req: MedusaRequest) {
  const originHeader = normalizeOrigin(getHeader(req, "origin"))

  if (originHeader) {
    return originHeader
  }

  const referer = toOptionalString(getHeader(req, "referer"))

  if (!referer) {
    return ""
  }

  try {
    const parsed = new URL(referer)
    return normalizeOrigin(parsed.origin)
  } catch {
    return ""
  }
}

export function buildClientFingerprint(parts: Array<string | undefined | null>) {
  const source = parts
    .map((part) => toOptionalString(part))
    .filter(Boolean)
    .join("|")

  return crypto.createHash("sha256").update(source).digest("hex")
}

export function normalizeUserAgent(value: string | undefined) {
  return toOptionalString(value).slice(0, 512)
}

function parseForwardedForHeader(value: string | undefined) {
  const raw = toOptionalString(value)

  if (!raw) {
    return ""
  }

  const first = raw.split(",")[0]
  return normalizeIpCandidate(first)
}

function normalizeIpCandidate(value: string | undefined) {
  const candidate = toOptionalString(value)

  if (!candidate) {
    return ""
  }

  const withoutPort = stripPort(candidate)
  const normalized = withoutPort.toLowerCase()

  if (normalized === LOOPBACK_V6) {
    return LOOPBACK_V4
  }

  if (normalized.startsWith(IPV4_MAPPED_PREFIX)) {
    return normalized.slice(IPV4_MAPPED_PREFIX.length)
  }

  return normalized
}

function stripPort(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return trimmed.slice(1, trimmed.indexOf("]"))
  }

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":")
    const last = parts[parts.length - 1]

    if (/^\d+$/.test(last) && parts.length > 2) {
      return parts.slice(0, -1).join(":")
    }

    if (/^\d+$/.test(last) && parts.length === 2) {
      return parts[0]
    }
  }

  return trimmed
}

function normalizeOrigin(value: string | undefined) {
  const candidate = toOptionalString(value)

  if (!candidate) {
    return ""
  }

  try {
    const parsed = new URL(candidate)

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return ""
    }

    return parsed.origin
  } catch {
    return ""
  }
}

function getHeader(req: MedusaRequest, name: string) {
  const direct = req.headers[name]
  const lower = req.headers[name.toLowerCase()]
  const value = direct ?? lower

  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === "string" ? value : undefined
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
