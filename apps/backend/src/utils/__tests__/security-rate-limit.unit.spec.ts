import {
  assertRateLimitStoreIsSafeForRuntime,
  evaluateRateLimit,
  evaluateRateLimitWithStore,
  resetRateLimitBucketsForTests,
  resolveRateLimitPolicyFromEnv,
  resolveRateLimitStoreMode,
  type RedisRateLimitClient,
  type RateLimitPolicy,
} from "../security-rate-limit"

const POLICY: RateLimitPolicy = {
  id: "unit-test-policy",
  maxRequests: 2,
  windowSeconds: 60,
  blockSeconds: 10,
}

describe("security-rate-limit", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests()
  })

  it("allows requests within threshold and blocks after overflow", () => {
    const first = evaluateRateLimit(POLICY, "client-key", 1_000)
    const second = evaluateRateLimit(POLICY, "client-key", 2_000)
    const third = evaluateRateLimit(POLICY, "client-key", 3_000)

    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(1)

    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(0)

    expect(third.allowed).toBe(false)
    expect(third.retryAfterSeconds).toBeGreaterThanOrEqual(10)
  })

  it("keeps blocked state during block window and recovers afterwards", () => {
    evaluateRateLimit(POLICY, "client-key", 1_000)
    evaluateRateLimit(POLICY, "client-key", 2_000)
    evaluateRateLimit(POLICY, "client-key", 3_000)

    const blocked = evaluateRateLimit(POLICY, "client-key", 8_000)
    const recovered = evaluateRateLimit(POLICY, "client-key", 70_000)

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)

    expect(recovered.allowed).toBe(true)
    expect(recovered.remaining).toBe(1)
  })

  it("resolves policy overrides from environment", () => {
    const policy = resolveRateLimitPolicyFromEnv(
      {
        SECURITY_LIMIT_SAMPLE_MAX_REQUESTS: "11",
        SECURITY_LIMIT_SAMPLE_WINDOW_SECONDS: "22",
        SECURITY_LIMIT_SAMPLE_BLOCK_SECONDS: "33",
      },
      "SECURITY_LIMIT_SAMPLE",
      {
        id: "sample",
        maxRequests: 1,
        windowSeconds: 1,
        blockSeconds: 1,
      }
    )

    expect(policy).toEqual({
      id: "sample",
      maxRequests: 11,
      windowSeconds: 22,
      blockSeconds: 33,
    })
  })

  it("defaults to memory store for local runtimes", () => {
    expect(resolveRateLimitStoreMode({})).toBe("memory")
    expect(resolveRateLimitStoreMode({ SECURITY_RATE_LIMIT_STORE: "memory" })).toBe(
      "memory"
    )
  })

  it("defaults to redis store for production runtimes", () => {
    expect(resolveRateLimitStoreMode({ NODE_ENV: "production" })).toBe("redis")
  })

  it("fails production startup when only the in-memory store is configured", () => {
    expect(() =>
      assertRateLimitStoreIsSafeForRuntime({
        NODE_ENV: "production",
        SECURITY_RATE_LIMIT_STORE: "memory",
      })
    ).toThrow(/not safe for production/)
  })

  it("accepts redis store for production when a Redis URL is configured", () => {
    expect(() =>
      assertRateLimitStoreIsSafeForRuntime({
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379",
      })
    ).not.toThrow()
  })

  it("fails fast when redis store has no Redis URL", () => {
    expect(() =>
      assertRateLimitStoreIsSafeForRuntime({
        SECURITY_RATE_LIMIT_STORE: "redis",
      })
    ).toThrow(/requires SECURITY_RATE_LIMIT_REDIS_URL or REDIS_URL/)
  })

  it("fails fast for unsupported rate-limit stores", () => {
    expect(() =>
      resolveRateLimitStoreMode({
        SECURITY_RATE_LIMIT_STORE: "postgres",
      })
    ).toThrow(/Unsupported SECURITY_RATE_LIMIT_STORE/)
  })

  it("maps redis store responses into rate-limit decisions", async () => {
    const redisClient: RedisRateLimitClient = {
      eval: jest.fn().mockResolvedValue([1, 2, 1, 0, 61_000]),
    }

    await expect(
      evaluateRateLimitWithStore(POLICY, "client-key", {
        env: {
          SECURITY_RATE_LIMIT_STORE: "redis",
          REDIS_URL: "redis://localhost:6379",
        },
        now: 1_000,
        redisClient,
      })
    ).resolves.toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
      resetAt: new Date(61_000).toISOString(),
    })
    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.stringContaining(":hits"),
      expect.stringContaining(":blocked"),
      "1000",
      60_000,
      10_000,
      2,
      expect.any(String),
      120_000
    )
  })

  it("fails closed when redis store returns an invalid response", async () => {
    const redisClient: RedisRateLimitClient = {
      eval: jest.fn().mockResolvedValue(["invalid"]),
    }

    await expect(
      evaluateRateLimitWithStore(POLICY, "client-key", {
        env: {
          SECURITY_RATE_LIMIT_STORE: "redis",
          REDIS_URL: "redis://localhost:6379",
        },
        redisClient,
      })
    ).rejects.toThrow(/invalid response/)
  })
})
