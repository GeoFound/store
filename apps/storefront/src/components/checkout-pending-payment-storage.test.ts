import { afterEach, describe, expect, it } from "vitest"
import {
  clearPendingPaymentState,
  persistPendingPaymentState,
  readPendingPaymentState,
} from "./checkout-pending-payment-storage"

const ATTEMPT_KEY = "store_pending_payment_attempt_id"
const CLAIM_TOKEN_KEY = "store_pending_payment_claim_token"
const INSTRUCTIONS_KEY = "store_pending_payment_instructions"
const VERSION_KEY = "store_pending_payment_storage_version"

describe("checkout pending payment storage", () => {
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("persists pending payment state in session storage", () => {
    persistPendingPaymentState("pay_1", "claim_1", {
      title: "Manual payment",
      body: "Send payment",
      reference: "ref_1",
    })

    expect(window.sessionStorage.getItem(VERSION_KEY)).toBe("session-v1")
    expect(window.sessionStorage.getItem(ATTEMPT_KEY)).toBe("pay_1")
    expect(window.sessionStorage.getItem(CLAIM_TOKEN_KEY)).toBe("claim_1")
    expect(JSON.parse(window.sessionStorage.getItem(INSTRUCTIONS_KEY) || "{}")).toEqual({
      title: "Manual payment",
      body: "Send payment",
      reference: "ref_1",
    })
  })

  it("migrates legacy local storage state to session storage", () => {
    window.localStorage.setItem(ATTEMPT_KEY, "pay_legacy")
    window.localStorage.setItem(CLAIM_TOKEN_KEY, "claim_legacy")
    window.localStorage.setItem(INSTRUCTIONS_KEY, "{\"reference\":\"ref\"}")

    expect(readPendingPaymentState()).toEqual({
      attemptId: "pay_legacy",
      claimToken: "claim_legacy",
      instructions: "{\"reference\":\"ref\"}",
    })
    expect(window.localStorage.getItem(ATTEMPT_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(ATTEMPT_KEY)).toBe("pay_legacy")
  })

  it("clears stale instructions when the next payment has no manual instructions", () => {
    persistPendingPaymentState("pay_manual", "claim_manual", {
      title: "Manual payment",
      body: "Send payment",
      reference: "ref_1",
    })

    persistPendingPaymentState("pay_crypto", "claim_crypto", null)

    expect(window.sessionStorage.getItem(ATTEMPT_KEY)).toBe("pay_crypto")
    expect(window.sessionStorage.getItem(CLAIM_TOKEN_KEY)).toBe("claim_crypto")
    expect(window.sessionStorage.getItem(INSTRUCTIONS_KEY)).toBeNull()
  })

  it("clears current and legacy pending payment state", () => {
    window.sessionStorage.setItem(ATTEMPT_KEY, "pay_session")
    window.localStorage.setItem(ATTEMPT_KEY, "pay_legacy")

    clearPendingPaymentState()

    expect(window.sessionStorage.getItem(ATTEMPT_KEY)).toBeNull()
    expect(window.localStorage.getItem(ATTEMPT_KEY)).toBeNull()
  })
})
