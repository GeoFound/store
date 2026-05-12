import {
  evaluateRateLimit,
  resetRateLimitBucketsForTests,
  resolveRateLimitPolicyFromEnv,
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
})
