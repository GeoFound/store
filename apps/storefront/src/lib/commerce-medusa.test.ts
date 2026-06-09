import { afterEach, describe, expect, it, vi } from "vitest"
import {
  loginCustomerAccount,
  registerCustomerAccount,
} from "./commerce-medusa"

describe("commerce-medusa account auth", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends a Turnstile token with login requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }))

    await loginCustomerAccount({
      email: "buyer@example.com",
      password: "password-123",
      turnstileToken: "turnstile-login-token",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "buyer@example.com",
          password: "password-123",
          turnstile_token: "turnstile-login-token",
        }),
      })
    )
  })

  it("sends a Turnstile token with register requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }))

    await registerCustomerAccount({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "password-123",
      turnstileToken: "turnstile-register-token",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "ada@example.com",
          password: "password-123",
          first_name: "Ada",
          last_name: "Lovelace",
          turnstile_token: "turnstile-register-token",
        }),
      })
    )
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}
