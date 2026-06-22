import { describe, expect, it } from "vitest"
import {
  isSafeMethod,
  isSameOriginRequest,
  resolveBrowserSuppliedOrigin,
} from "./origin"

describe("admin BFF origin checks", () => {
  it("treats read methods as safe without browser origin headers", () => {
    expect(isSafeMethod("GET")).toBe(true)
    expect(
      isSameOriginRequest(new Request("https://admin.example.com/api/admin/custom")),
    ).toBe(true)
  })

  it("accepts same-origin mutations with Origin", () => {
    const request = new Request("https://admin.example.com/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
      },
    })

    expect(resolveBrowserSuppliedOrigin(request)).toBe("https://admin.example.com")
    expect(isSameOriginRequest(request)).toBe(true)
  })

  it("accepts same-origin mutations with Referer when Origin is absent", () => {
    const request = new Request("https://admin.example.com/api/admin/orders", {
      method: "PATCH",
      headers: {
        referer: "https://admin.example.com/dashboard/orders",
      },
    })

    expect(resolveBrowserSuppliedOrigin(request)).toBe("https://admin.example.com")
    expect(isSameOriginRequest(request)).toBe(true)
  })

  it("rejects mutations without browser origin evidence", () => {
    expect(
      isSameOriginRequest(
        new Request("https://admin.example.com/api/admin/orders", {
          method: "POST",
        }),
      ),
    ).toBe(false)
  })

  it("rejects cross-origin mutations", () => {
    expect(
      isSameOriginRequest(
        new Request("https://admin.example.com/api/admin/orders", {
          method: "DELETE",
          headers: {
            origin: "https://evil.example.com",
          },
        }),
      ),
    ).toBe(false)
  })

  it("accepts the public origin from ADMIN_TRUSTED_ORIGINS when request.url differs (behind a proxy)", () => {
    const previous = process.env.ADMIN_TRUSTED_ORIGINS
    process.env.ADMIN_TRUSTED_ORIGINS =
      "https://admin.example.com, https://ops.example.com"

    try {
      // request.url host/scheme is the internal one (proxy-terminated TLS),
      // but the browser Origin is the configured public origin.
      const request = new Request("http://127.0.0.1:8001/api/admin/orders", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
        },
      })

      expect(isSameOriginRequest(request)).toBe(true)
    } finally {
      process.env.ADMIN_TRUSTED_ORIGINS = previous
    }
  })

  it("still rejects untrusted origins when an allowlist is configured", () => {
    const previous = process.env.ADMIN_TRUSTED_ORIGINS
    process.env.ADMIN_TRUSTED_ORIGINS = "https://admin.example.com"

    try {
      const request = new Request("http://127.0.0.1:8001/api/admin/orders", {
        method: "POST",
        headers: {
          origin: "https://evil.example.com",
        },
      })

      expect(isSameOriginRequest(request)).toBe(false)
    } finally {
      process.env.ADMIN_TRUSTED_ORIGINS = previous
    }
  })
})
