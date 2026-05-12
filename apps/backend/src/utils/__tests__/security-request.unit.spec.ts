import type { MedusaRequest } from "@medusajs/framework/http"
import {
  buildClientFingerprint,
  normalizeUserAgent,
  parseAllowedOriginsFromEnv,
  resolveRequestIp,
  resolveRequestOrigin,
} from "../security-request"

function buildRequest(input: {
  headers?: Record<string, string | string[] | undefined>
  remoteAddress?: string
}) {
  return {
    headers: input.headers || {},
    socket: {
      remoteAddress: input.remoteAddress,
    },
  } as unknown as MedusaRequest
}

describe("security-request", () => {
  it("uses socket address when proxy headers are not trusted", () => {
    const req = buildRequest({
      headers: {
        "x-forwarded-for": "203.0.113.100",
      },
      remoteAddress: "127.0.0.1",
    })

    expect(
      resolveRequestIp(req, {
        SECURITY_TRUST_PROXY_HEADERS: "false",
      })
    ).toBe("127.0.0.1")
  })

  it("uses forwarded headers when explicitly trusted", () => {
    const req = buildRequest({
      headers: {
        "x-forwarded-for": "203.0.113.100, 10.0.0.1",
      },
      remoteAddress: "::1",
    })

    expect(
      resolveRequestIp(req, {
        SECURITY_TRUST_PROXY_HEADERS: "true",
      })
    ).toBe("203.0.113.100")
  })

  it("collects and deduplicates allowed origins from env", () => {
    expect(
      parseAllowedOriginsFromEnv({
        STORE_CORS: "https://shop.example.com",
        ADMIN_CORS: "https://api.example.com",
        AUTH_CORS: "https://shop.example.com,https://api.example.com",
        SECURITY_ALLOWED_ORIGINS: "https://checkout.example.com",
      })
    ).toEqual([
      "https://shop.example.com",
      "https://api.example.com",
      "https://checkout.example.com",
    ])
  })

  it("resolves origin from origin header and referer fallback", () => {
    const fromOrigin = buildRequest({
      headers: {
        origin: "https://shop.example.com",
      },
    })
    const fromReferer = buildRequest({
      headers: {
        referer: "https://shop.example.com/orders/123",
      },
    })

    expect(resolveRequestOrigin(fromOrigin)).toBe("https://shop.example.com")
    expect(resolveRequestOrigin(fromReferer)).toBe("https://shop.example.com")
  })

  it("builds deterministic fingerprint and caps user-agent length", () => {
    const longUserAgent = "a".repeat(800)

    expect(
      buildClientFingerprint(["127.0.0.1", "Mozilla/5.0", "/store/orders/recover"])
    ).toBe(
      buildClientFingerprint(["127.0.0.1", "Mozilla/5.0", "/store/orders/recover"])
    )
    expect(normalizeUserAgent(longUserAgent)).toHaveLength(512)
  })
})
