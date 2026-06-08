import { describe, expect, it, beforeEach } from "vitest"
import {
  buildAccountAuthRateLimitKey,
  evaluateAccountAuthRateLimit,
  resetAccountAuthRateLimitForTests,
  resolveAccountAuthRateLimitPolicy,
} from "./server-abuse-guard"

describe("server abuse guard", () => {
  beforeEach(() => {
    resetAccountAuthRateLimitForTests()
  })

  it("resolves account auth rate limit policy from env with safe defaults", () => {
    expect(resolveAccountAuthRateLimitPolicy({})).toEqual({
      maxRequests: 20,
      windowSeconds: 600,
      blockSeconds: 900,
      maxKeys: 10000,
    })
    expect(
      resolveAccountAuthRateLimitPolicy({
        ACCOUNT_AUTH_RATE_LIMIT_MAX_REQUESTS: "2",
        ACCOUNT_AUTH_RATE_LIMIT_WINDOW_SECONDS: "30",
        ACCOUNT_AUTH_RATE_LIMIT_BLOCK_SECONDS: "90",
        ACCOUNT_AUTH_RATE_LIMIT_MAX_KEYS: "50",
      })
    ).toEqual({
      maxRequests: 2,
      windowSeconds: 30,
      blockSeconds: 90,
      maxKeys: 50,
    })
  })

  it("blocks requests after the configured threshold", () => {
    const policy = {
      maxRequests: 2,
      windowSeconds: 60,
      blockSeconds: 120,
      maxKeys: 100,
    }

    expect(
      evaluateAccountAuthRateLimit({
        key: "login:client",
        policy,
        nowMs: 1000,
      }).allowed
    ).toBe(true)
    expect(
      evaluateAccountAuthRateLimit({
        key: "login:client",
        policy,
        nowMs: 2000,
      }).allowed
    ).toBe(true)

    expect(
      evaluateAccountAuthRateLimit({
        key: "login:client",
        policy,
        nowMs: 3000,
      })
    ).toEqual({
      allowed: false,
      retryAfterSeconds: 120,
    })
  })

  it("uses Cloudflare connecting IP ahead of forwarded headers", () => {
    const request = new Request("https://example.test/api/account/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.10, 198.51.100.11",
        "user-agent": "vitest",
      },
    })

    expect(buildAccountAuthRateLimitKey(request, "login")).toBe(
      "login:203.0.113.10:vitest"
    )
  })
})
