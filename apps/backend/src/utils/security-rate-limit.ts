import crypto from "crypto"
import Redis from "ioredis"

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

export type RateLimitStoreMode = "memory" | "redis"

export type RedisRateLimitClient = {
  status?: string
  connect?: () => Promise<unknown>
  disconnect?: () => void
  eval(
    script: string,
    numberOfKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>
}

export type EvaluateRateLimitOptions = {
  env?: Record<string, string | undefined>
  now?: number
  redisClient?: RedisRateLimitClient
  redisPrefix?: string
}

type RateLimitBucket = {
  hits: number[]
  blockedUntilMs: number
  lastSeenMs: number
}

const buckets = new Map<string, RateLimitBucket>()
let rateLimitRedisClient: Redis | null = null
let rateLimitRedisConnectPromise: Promise<unknown> | null = null

const REDIS_RATE_LIMIT_SCRIPT = `
local hits_key = KEYS[1]
local block_key = KEYS[2]
local provided_now = ARGV[1]
local window_ms = tonumber(ARGV[2])
local block_ms = tonumber(ARGV[3])
local max_requests = tonumber(ARGV[4])
local member = ARGV[5]
local ttl_ms = tonumber(ARGV[6])

local now_ms
if provided_now ~= "" then
  now_ms = tonumber(provided_now)
else
  local redis_time = redis.call("TIME")
  now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
end

local blocked_until = tonumber(redis.call("GET", block_key) or "0")
if blocked_until > now_ms then
  return {0, max_requests, 0, blocked_until - now_ms, blocked_until}
end

redis.call("ZREMRANGEBYSCORE", hits_key, "-inf", now_ms - window_ms)
local hit_count = tonumber(redis.call("ZCARD", hits_key))

if hit_count >= max_requests then
  local next_blocked_until = now_ms + block_ms
  redis.call("SET", block_key, tostring(next_blocked_until), "PX", block_ms)
  redis.call("ZADD", hits_key, now_ms, member)
  redis.call("PEXPIRE", hits_key, ttl_ms)
  return {0, max_requests, 0, block_ms, next_blocked_until}
end

redis.call("ZADD", hits_key, now_ms, member)
redis.call("PEXPIRE", hits_key, ttl_ms)

return {1, max_requests, math.max(0, max_requests - hit_count - 1), 0, now_ms + window_ms}
`

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

export async function evaluateRateLimitWithStore(
  policy: RateLimitPolicy,
  key: string,
  options: EvaluateRateLimitOptions = {}
): Promise<RateLimitDecision> {
  const env = options.env || process.env

  if (resolveRateLimitStoreMode(env) === "memory") {
    return evaluateRateLimit(policy, key, options.now ?? Date.now())
  }

  return evaluateRedisRateLimit(policy, key, options)
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

export function assertRateLimitStoreIsSafeForRuntime(
  env: Record<string, string | undefined> = process.env
) {
  const storeMode = resolveRateLimitStoreMode(env)

  if (storeMode === "memory" && env.NODE_ENV === "production") {
    throw new Error(
      "SECURITY_RATE_LIMIT_STORE=memory is not safe for production. Configure SECURITY_RATE_LIMIT_STORE=redis before enabling security-guard in production."
    )
  }

  if (storeMode === "redis" && !resolveRateLimitRedisUrl(env)) {
    throw new Error(
      "SECURITY_RATE_LIMIT_STORE=redis requires SECURITY_RATE_LIMIT_REDIS_URL or REDIS_URL"
    )
  }
}

export function resolveRateLimitStoreMode(
  env: Record<string, string | undefined> = process.env
): RateLimitStoreMode {
  const normalized = normalizeString(env.SECURITY_RATE_LIMIT_STORE).toLowerCase()

  if (!normalized) {
    return env.NODE_ENV === "production" ? "redis" : "memory"
  }

  if (normalized === "memory" || normalized === "redis") {
    return normalized
  }

  throw new Error(
    `Unsupported SECURITY_RATE_LIMIT_STORE "${normalized}". Supported values: memory, redis.`
  )
}

export async function resetRateLimitRedisClientForTests() {
  if (rateLimitRedisClient) {
    rateLimitRedisClient.disconnect()
  }

  rateLimitRedisClient = null
  rateLimitRedisConnectPromise = null
}

async function evaluateRedisRateLimit(
  policy: RateLimitPolicy,
  key: string,
  options: EvaluateRateLimitOptions
): Promise<RateLimitDecision> {
  const env = options.env || process.env
  const safePolicy = normalizePolicy(policy)
  const redisClient = options.redisClient || getRateLimitRedisClient(env)
  const bucketKey = `${safePolicy.id}:${hashKey(key)}`
  const keyPrefix =
    normalizeString(options.redisPrefix) ||
    normalizeString(env.SECURITY_RATE_LIMIT_REDIS_PREFIX) ||
    "store:security:rate-limit:"
  const redisKeyBase = `${keyPrefix}{${bucketKey}}`
  const windowMs = safePolicy.windowSeconds * 1000
  const blockMs = safePolicy.blockSeconds * 1000
  const ttlMs = Math.max(windowMs, blockMs) + 60_000

  await ensureRedisClientReady(redisClient)

  const result = await redisClient.eval(
    REDIS_RATE_LIMIT_SCRIPT,
    2,
    `${redisKeyBase}:hits`,
    `${redisKeyBase}:blocked`,
    typeof options.now === "number" ? String(options.now) : "",
    windowMs,
    blockMs,
    safePolicy.maxRequests,
    `${options.now ?? Date.now()}:${crypto.randomUUID()}`,
    ttlMs
  )
  const values = parseRedisRateLimitResult(result)
  const retryAfterMs = Math.max(0, values[3])

  return {
    allowed: values[0] === 1,
    limit: values[1],
    remaining: Math.max(0, values[2]),
    retryAfterSeconds: retryAfterMs
      ? Math.max(1, Math.ceil(retryAfterMs / 1000))
      : 0,
    resetAt: new Date(values[4]).toISOString(),
  }
}

function getRateLimitRedisClient(
  env: Record<string, string | undefined>
): Redis {
  if (rateLimitRedisClient) {
    return rateLimitRedisClient
  }

  const redisUrl = resolveRateLimitRedisUrl(env)

  if (!redisUrl) {
    throw new Error(
      "SECURITY_RATE_LIMIT_STORE=redis requires SECURITY_RATE_LIMIT_REDIS_URL or REDIS_URL"
    )
  }

  rateLimitRedisClient = new Redis(redisUrl, {
    commandTimeout: parsePositiveInt(
      env.SECURITY_RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS,
      1_000
    ),
    connectTimeout: parsePositiveInt(
      env.SECURITY_RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS,
      1_000
    ),
    connectionName: "store-security-rate-limit",
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
  rateLimitRedisClient.on("error", () => {
    // Request evaluation fails closed; this listener prevents unhandled errors.
  })

  return rateLimitRedisClient
}

async function ensureRedisClientReady(client: RedisRateLimitClient) {
  if (!client.connect || client.status === "ready") {
    return
  }

  if (!rateLimitRedisConnectPromise) {
    rateLimitRedisConnectPromise = client.connect().catch((error) => {
      rateLimitRedisConnectPromise = null
      throw error
    })
  }

  await rateLimitRedisConnectPromise
}

function parseRedisRateLimitResult(result: unknown): number[] {
  if (!Array.isArray(result) || result.length < 5) {
    throw new Error("Redis rate-limit store returned an invalid response")
  }

  const values = result.slice(0, 5).map((value) => Number(value))

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Redis rate-limit store returned non-numeric values")
  }

  return values
}

function resolveRateLimitRedisUrl(env: Record<string, string | undefined>) {
  return (
    normalizeString(env.SECURITY_RATE_LIMIT_REDIS_URL) ||
    normalizeString(env.REDIS_URL)
  )
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

  const staleThresholdMs =
    now - (Math.max(policy.windowSeconds, policy.blockSeconds) + 600) * 1000

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
  return (
    parsePositiveInt(process.env.SECURITY_RATE_LIMIT_MAX_KEYS, 50_000) ||
    50_000
  )
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

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
