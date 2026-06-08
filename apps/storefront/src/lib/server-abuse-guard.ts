import { NextResponse } from "next/server"

type Env = Record<string, string | undefined>

type RateLimitPolicy = {
  maxRequests: number
  windowSeconds: number
  blockSeconds: number
  maxKeys: number
}

type RateLimitEntry = {
  count: number
  windowExpiresAt: number
  blockedUntil: number
}

const accountAuthBuckets = new Map<string, RateLimitEntry>()

export function resolveAccountAuthRateLimitPolicy(
  env: Env = process.env
): RateLimitPolicy {
  return {
    maxRequests: positiveInt(env.ACCOUNT_AUTH_RATE_LIMIT_MAX_REQUESTS, 20),
    windowSeconds: positiveInt(env.ACCOUNT_AUTH_RATE_LIMIT_WINDOW_SECONDS, 600),
    blockSeconds: positiveInt(env.ACCOUNT_AUTH_RATE_LIMIT_BLOCK_SECONDS, 900),
    maxKeys: positiveInt(env.ACCOUNT_AUTH_RATE_LIMIT_MAX_KEYS, 10000),
  }
}

export function evaluateAccountAuthRateLimit(input: {
  key: string
  policy?: RateLimitPolicy
  nowMs?: number
}) {
  const policy = input.policy || resolveAccountAuthRateLimitPolicy()
  const nowMs = input.nowMs ?? Date.now()
  const existing = accountAuthBuckets.get(input.key)

  if (existing && existing.blockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - nowMs) / 1000)),
    }
  }

  if (!existing || existing.windowExpiresAt <= nowMs) {
    trimAccountAuthBuckets(policy.maxKeys, nowMs)
    accountAuthBuckets.set(input.key, {
      count: 1,
      windowExpiresAt: nowMs + policy.windowSeconds * 1000,
      blockedUntil: 0,
    })

    return {
      allowed: true,
      retryAfterSeconds: 0,
    }
  }

  existing.count += 1

  if (existing.count > policy.maxRequests) {
    existing.blockedUntil = nowMs + policy.blockSeconds * 1000

    return {
      allowed: false,
      retryAfterSeconds: policy.blockSeconds,
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  }
}

export function checkAccountAuthRateLimit(
  request: Request,
  action: string,
  env: Env = process.env
) {
  const key = buildAccountAuthRateLimitKey(request, action)
  const decision = evaluateAccountAuthRateLimit({
    key,
    policy: resolveAccountAuthRateLimitPolicy(env),
  })

  if (decision.allowed) {
    return null
  }

  return NextResponse.json(
    {
      message: "Too many account requests. Please wait and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
      },
    }
  )
}

export async function verifyAccountTurnstile(input: {
  request: Request
  token?: string | null
  env?: Env
}) {
  const env = input.env || process.env

  if (!truthy(env.ACCOUNT_AUTH_TURNSTILE_ENABLED)) {
    return null
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return "Account challenge is enabled but TURNSTILE_SECRET_KEY is missing."
  }

  if (!input.token) {
    return "Account challenge token is required."
  }

  const body = new URLSearchParams()
  body.set("secret", env.TURNSTILE_SECRET_KEY)
  body.set("response", input.token)

  const remoteIp = resolveClientIp(input.request)

  if (remoteIp) {
    body.set("remoteip", remoteIp)
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  })
  const result = (await response.json().catch(() => null)) as {
    success?: boolean
  } | null

  return result?.success ? null : "Account challenge verification failed."
}

export function buildAccountAuthRateLimitKey(request: Request, action: string) {
  return [
    action,
    resolveClientIp(request) || "unknown-ip",
    request.headers.get("user-agent") || "unknown-agent",
  ].join(":")
}

export function resetAccountAuthRateLimitForTests() {
  accountAuthBuckets.clear()
}

function resolveClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")

  if (cloudflareIp) {
    return cloudflareIp.trim()
  }

  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || ""
  }

  return request.headers.get("x-real-ip")?.trim() || ""
}

function trimAccountAuthBuckets(maxKeys: number, nowMs: number) {
  if (accountAuthBuckets.size < maxKeys) {
    return
  }

  for (const [key, entry] of accountAuthBuckets) {
    if (entry.windowExpiresAt <= nowMs && entry.blockedUntil <= nowMs) {
      accountAuthBuckets.delete(key)
    }

    if (accountAuthBuckets.size < maxKeys) {
      return
    }
  }

  const firstKey = accountAuthBuckets.keys().next().value as string | undefined

  if (firstKey) {
    accountAuthBuckets.delete(firstKey)
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function truthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase())
}
