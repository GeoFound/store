import { describe, expect, it } from "vitest"
import {
  isCustomerAccountEnabled,
  isCustomerPasswordResetEnabled,
  resolveCustomerAccountMode,
  resolveCustomerEmailVerificationStrategy,
  resolveCustomerPasswordResetUrl,
} from "./customer-account-policy"

describe("customer account policy", () => {
  it("defaults to guest-optional accounts with password reset enabled", () => {
    expect(resolveCustomerAccountMode({})).toBe("guest_optional")
    expect(isCustomerAccountEnabled({})).toBe(true)
    expect(isCustomerPasswordResetEnabled({})).toBe(true)
    expect(resolveCustomerEmailVerificationStrategy({})).toBe("recovery_only")
  })

  it("disables account and password reset in guest-only mode", () => {
    const env = {
      CUSTOMER_ACCOUNT_MODE: "guest_only",
      CUSTOMER_PASSWORD_RESET_ENABLED: "true",
    }

    expect(resolveCustomerAccountMode(env)).toBe("guest_only")
    expect(isCustomerAccountEnabled(env)).toBe(false)
    expect(isCustomerPasswordResetEnabled(env)).toBe(false)
  })

  it("prefers explicit reset URL and falls back to storefront origin", () => {
    expect(
      resolveCustomerPasswordResetUrl({
        env: {
          CUSTOMER_PASSWORD_RESET_URL: "https://store.example.com/account/reset-password/",
        },
      })
    ).toBe("https://store.example.com/account/reset-password")

    expect(
      resolveCustomerPasswordResetUrl({
        requestUrl: "https://store.example.com/api/account/password-reset/request",
        env: {},
      })
    ).toBe("https://store.example.com/account/reset-password")
  })
})
