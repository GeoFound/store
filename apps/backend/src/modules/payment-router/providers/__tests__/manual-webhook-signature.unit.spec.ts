import crypto from "crypto"
import { assertManualWebhookSignature } from "../manual-webhook-signature"

describe("manual webhook signature", () => {
  const originalSecret = process.env.MANUAL_WEBHOOK_SECRET
  const originalTolerance = process.env.MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS

  beforeEach(() => {
    process.env.MANUAL_WEBHOOK_SECRET = "manual-webhook-unit-test-secret"
    process.env.MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = "300"
  })

  afterEach(() => {
    process.env.MANUAL_WEBHOOK_SECRET = originalSecret
    process.env.MANUAL_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = originalTolerance
  })

  it("accepts valid signatures", () => {
    const payload = {
      provider_order_id: "manual_1",
      status: "paid",
    }
    const rawBody = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = crypto
      .createHmac("sha256", process.env.MANUAL_WEBHOOK_SECRET || "")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    expect(() =>
      assertManualWebhookSignature(payload, {
        rawBody,
        headers: {
          "x-manual-webhook-timestamp": timestamp,
          "x-manual-webhook-signature": signature,
        },
      })
    ).not.toThrow()
  })

  it("rejects mismatched signatures", () => {
    const payload = {
      provider_order_id: "manual_1",
      status: "paid",
    }
    const rawBody = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000).toString()

    expect(() =>
      assertManualWebhookSignature(payload, {
        rawBody,
        headers: {
          "x-manual-webhook-timestamp": timestamp,
          "x-manual-webhook-signature": "bad-signature",
        },
      })
    ).toThrow("Invalid manual webhook signature")
  })

  it("rejects expired timestamps", () => {
    const payload = {
      provider_order_id: "manual_1",
      status: "paid",
    }
    const rawBody = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000) - 1000
    const signature = crypto
      .createHmac("sha256", process.env.MANUAL_WEBHOOK_SECRET || "")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")

    expect(() =>
      assertManualWebhookSignature(payload, {
        rawBody,
        headers: {
          "x-manual-webhook-timestamp": String(timestamp),
          "x-manual-webhook-signature": signature,
        },
      })
    ).toThrow("Manual webhook signature has expired")
  })
})
