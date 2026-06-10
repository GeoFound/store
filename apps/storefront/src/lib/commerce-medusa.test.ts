import { afterEach, describe, expect, it, vi } from "vitest"
import {
  confirmCustomerAccountPasswordReset,
  loginCustomerAccount,
  registerCustomerAccount,
  requestCustomerAccountPasswordReset,
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

  it("sends a Turnstile token with password reset requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }))

    await requestCustomerAccountPasswordReset({
      email: "buyer@example.com",
      turnstileToken: "turnstile-reset-token",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/password-reset/request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "buyer@example.com",
          turnstile_token: "turnstile-reset-token",
        }),
      })
    )
  })

  it("sends token and password with password reset confirmation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }))

    await confirmCustomerAccountPasswordReset({
      token: "reset-token",
      password: "password-123",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/password-reset/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "reset-token",
          password: "password-123",
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
