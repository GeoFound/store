import {
  assertClaimToken,
  attachClaimToken,
  extractFulfillmentItems,
  extractInventoryReservations,
  isClaimTemporarilyBlocked,
  isPaymentAttemptFinalized,
  markPaymentAttemptFinalizationFailed,
  markPaymentAttemptFinalized,
  markPaymentAttemptFinalizing,
  markClaimTokenConsumed,
  normalizeAttemptPayload,
  recordFailedClaimAttempt,
} from "../payment-attempt"

describe("payment attempt payload utils", () => {
  it("normalizes unknown payloads", () => {
    expect(normalizeAttemptPayload(null)).toEqual({})
    expect(normalizeAttemptPayload("bad")).toEqual({})
  })

  it("extracts inventory reservations only from valid payloads", () => {
    const payload = {
      inventory_reservations: [
        {
          reservation_key: "payment_attempt:1:item_1",
          item_ids: ["acc_1"],
        },
        {
          reservation_key: 123,
          item_ids: [],
        },
      ],
    }

    expect(extractInventoryReservations(payload)).toEqual([
      {
        reservation_key: "payment_attempt:1:item_1",
        item_ids: ["acc_1"],
      },
    ])
  })

  it("extracts explicit fulfillment items for no-inventory deliveries", () => {
    const payload = {
      fulfillment_items: [
        {
          fulfillment_key: "payment_attempt:1:item_file",
          cart_item_id: "item_file",
          product_variant_id: "variant_file",
          quantity: 1,
          inventory_mode: "none",
          delivery_handler_code: "manual",
          metadata: {
            fulfillment_key: "payment_attempt:1:item_file",
          },
        },
        {
          fulfillment_key: "bad_missing_delivery_handler",
          product_variant_id: "variant_bad",
          quantity: 1,
          inventory_mode: "none",
        },
      ],
    }

    expect(extractFulfillmentItems(payload)).toEqual([
      {
        fulfillment_key: "payment_attempt:1:item_file",
        cart_item_id: "item_file",
        product_variant_id: "variant_file",
        quantity: 1,
        inventory_mode: "none",
        delivery_handler_code: "manual",
        metadata: {
          fulfillment_key: "payment_attempt:1:item_file",
        },
      },
    ])
  })

  it("stores and consumes claim tokens safely", () => {
    const claimToken = "claim_1234567890"
    const payload = attachClaimToken({}, claimToken, {
      orderAccessProviderCode: "guest-order-access",
    })

    expect(payload.order_access_provider_code).toBe("guest-order-access")
    expect(payload.order_access_claimed_at).toBeNull()
    expect(payload.order_access_claim_token_hint).toBe(claimToken.slice(-6))
    expect(() => assertClaimToken(payload, claimToken)).not.toThrow()
    expect(() => assertClaimToken(payload, "claim_wrong")).toThrow(
      "Invalid order access claim token"
    )

    const consumed = markClaimTokenConsumed(payload)

    expect(consumed.order_access_claimed_at).toBeTruthy()
    expect(() => assertClaimToken(consumed, claimToken)).toThrow(
      "Order access can no longer be claimed from this payment attempt"
    )
  })

  it("tracks failed claim attempts and temporary blocks", () => {
    const now = new Date("2026-05-11T02:00:00.000Z")
    const firstFailure = recordFailedClaimAttempt({}, { now, maxAttempts: 2 })
    const secondFailure = recordFailedClaimAttempt(firstFailure, {
      now,
      maxAttempts: 2,
    })

    expect(firstFailure.order_access_claim_failed_attempts).toBe(1)
    expect(firstFailure.order_access_claim_blocked_until).toBeNull()
    expect(secondFailure.order_access_claim_failed_attempts).toBe(2)
    expect(secondFailure.order_access_claim_blocked_until).toBeTruthy()
    expect(isClaimTemporarilyBlocked(secondFailure, now)).toBe(true)
  })

  it("marks payment attempts as finalized for replay idempotency", () => {
    const payload = markPaymentAttemptFinalized({})

    expect(isPaymentAttemptFinalized(payload)).toBe(true)
    expect(payload.payment_finalization_status).toBe("finalized")
    expect(payload.payment_finalization_error).toBeNull()
  })

  it("tracks payment finalization processing and failed states", () => {
    const processing = markPaymentAttemptFinalizing({})
    const failed = markPaymentAttemptFinalizationFailed(
      processing,
      "Delivery handler manual is not registered"
    )

    expect(processing.payment_finalization_status).toBe("processing")
    expect(processing.payment_finalization_error).toBeNull()
    expect(failed.payment_finalization_status).toBe("failed")
    expect(failed.payment_finalization_error).toBe(
      "Delivery handler manual is not registered"
    )
    expect(isPaymentAttemptFinalized(failed)).toBe(false)
  })
})
