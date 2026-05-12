import crypto from "crypto"

export type RateLimitPolicy = {
  id: string
  maxRequests: number
  windowSeconds: number
  blockSeconds: number
}

export type RateLimitDecision = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
  resetAt: string
}

type RateLimitBucket = {
  hits: number[]
  blockedUntilMs: number
  lastSeenMs: number
}

const buckets = new Map<string, RateLimitBucket>()

export function evaluateRateLimit(
  policy: RateLimitPolicy,
  key: string,
  now = Date.now()
): RateLimitDecision {
  const safePolicy = normalizePolicy(policy)
  const bucketKey = `${safePolicy.id}:${hashKey(key)}`
  const windowMs = safePolicy.windowSeconds * 1000
  const blockMs = safePolicy.blockSeconds * 1000
  const resetAtMs = now + windowMs

  const bucket = buckets.get(bucketKey) || {
    hits: [],
    blockedUntilMs: 0,
    lastSeenMs: now,
  }
  bucket.lastSeenMs = now

  if (bucket.blockedUntilMs > now) {
    buckets.set(bucketKey, bucket)
    cleanupRateLimitBuckets(now, safePolicy)
    return {
      allowed: false,
      limit: safePolicy.maxRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.blockedUntilMs - now) / 1000)
      ),
      resetAt: new Date(bucket.blockedUntilMs).toISOString(),
    }
  }

  const windowStart = now - windowMs
  bucket.hits = bucket.hits.filter((timestamp) => timestamp > windowStart)

  if (bucket.hits.length >= safePolicy.maxRequests) {
    bucket.blockedUntilMs = now + blockMs
    bucket.hits.push(now)
    buckets.set(bucketKey, bucket)
    cleanupRateLimitBuckets(now, safePolicy)
    return {
      allowed: false,
      limit: safePolicy.maxRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(blockMs / 1000)),
      resetAt: new Date(bucket.blockedUntilMs).toISOString(),
    }
  }

  bucket.hits.push(now)
  bucket.blockedUntilMs = 0
  buckets.set(bucketKey, bucket)
  cleanupRateLimitBuckets(now, safePolicy)

  return {
    allowed: true,
    limit: safePolicy.maxRequests,
    remaining: Math.max(0, safePolicy.maxRequests - bucket.hits.length),
    retryAfterSeconds: 0,
    resetAt: new Date(resetAtMs).toISOString(),
  }
}

export function resolveRateLimitPolicyFromEnv(
  env: Record<string, string | undefined>,
  prefix: string,
  fallback: RateLimitPolicy
): RateLimitPolicy {
  return normalizePolicy({
    id: fallback.id,
    maxRequests:
      parsePositiveInt(env[`${prefix}_MAX_REQUESTS`], fallback.maxRequests) ||
      fallback.maxRequests,
    windowSeconds:
      parsePositiveInt(env[`${prefix}_WINDOW_SECONDS`], fallback.windowSeconds) ||
      fallback.windowSeconds,
    blockSeconds:
      parsePositiveInt(env[`${prefix}_BLOCK_SECONDS`], fallback.blockSeconds) ||
      fallback.blockSeconds,
  })
}

export function resetRateLimitBucketsForTests() {
  buckets.clear()
}

function cleanupRateLimitBuckets(now: number, policy: RateLimitPolicy) {
  const maxTrackedKeys = resolveMaxTrackedKeys()

  if (buckets.size > maxTrackedKeys) {
    // Remove oldest entries first when memory pressure grows.
    const sorted = Array.from(buckets.entries()).sort(
      (left, right) => left[1].lastSeenMs - right[1].lastSeenMs
    )
    const toDelete = sorted.slice(0, Math.ceil(sorted.length * 0.2))

    for (const [bucketKey] of toDelete) {
      buckets.delete(bucketKey)
    }
  }

  const staleThresholdMs = now - (Math.max(policy.windowSeconds, policy.blockSeconds) + 600) * 1000

  for (const [bucketKey, bucket] of buckets.entries()) {
    if (
      bucket.lastSeenMs < staleThresholdMs &&
      bucket.blockedUntilMs < now &&
      bucket.hits.every((timestamp) => timestamp < staleThresholdMs)
    ) {
      buckets.delete(bucketKey)
    }
  }
}

function resolveMaxTrackedKeys() {
  return parsePositiveInt(process.env.SECURITY_RATE_LIMIT_MAX_KEYS, 50_000) || 50_000
}

function normalizePolicy(policy: RateLimitPolicy): RateLimitPolicy {
  return {
    id: policy.id,
    maxRequests: Math.max(1, Math.floor(policy.maxRequests || 1)),
    windowSeconds: Math.max(1, Math.floor(policy.windowSeconds || 1)),
    blockSeconds: Math.max(1, Math.floor(policy.blockSeconds || 1)),
  }
}

function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32)
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}
