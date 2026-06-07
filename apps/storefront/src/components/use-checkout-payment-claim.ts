import { useEffect } from "react"
import {
  claimOrderAccess,
  retrievePaymentAttempt,
} from "@/lib/commerce"
import {
  emitStoreAnalyticsEvent,
  minorToDecimal,
} from "@/lib/analytics"
import type {
  Cart,
  MarketingResolvedContext,
  PaymentAttempt,
} from "@/lib/types"
import { clearPendingPaymentState } from "./checkout-pending-payment-storage"
import { persistOrderAccessToken } from "./order-access-token-storage"

export function useCheckoutPaymentClaim({
  cartItems,
  claimToken,
  orderAccessToken,
  paymentAttempt,
  setClaiming,
  setError,
  setMessage,
  setOrderAccessToken,
  setPaymentAttempt,
  setResolvedMarketing,
}: {
  cartItems?: Cart["items"]
  claimToken: string
  orderAccessToken: string
  paymentAttempt: PaymentAttempt | null
  setClaiming: (value: boolean) => void
  setError: (value: string) => void
  setMessage: (value: string) => void
  setOrderAccessToken: (value: string) => void
  setPaymentAttempt: (value: PaymentAttempt) => void
  setResolvedMarketing: (value: MarketingResolvedContext | null) => void
}) {
  useEffect(() => {
    if (!paymentAttempt?.id || !claimToken || orderAccessToken) {
      return
    }

    let active = true
    let timeout: number | undefined

    const pollAttempt = async () => {
      try {
        const { attempt } = await retrievePaymentAttempt(paymentAttempt.id)

        if (!active) {
          return
        }

        setPaymentAttempt(attempt)
        setResolvedMarketing(normalizeResolvedMarketing(attempt.marketing_context))

        if (attempt.status === "paid") {
          if (!attempt.payment_finalized_at) {
            if (attempt.payment_finalization_status === "failed") {
              setError(
                attempt.payment_finalization_error ||
                  "Payment was confirmed, but order fulfillment needs support review."
              )
              return
            }

            setMessage("Payment confirmed. Preparing order access...")
            timeout = window.setTimeout(() => {
              void pollAttempt()
            }, 4000)
            return
          }

          if (attempt.order_access_claimed_at) {
            clearPendingPaymentState()
            setMessage(
              "Payment confirmed. Order access was already claimed in another session."
            )
            return
          }

          setClaiming(true)
          const claimed = await claimOrderAccess({
            attemptId: attempt.id,
            claimToken,
          })

          if (!active) {
            return
          }

          setOrderAccessToken(claimed.access_token)
          persistOrderAccessToken(claimed.access_token)
          emitStoreAnalyticsEvent(
            "purchase",
            {
              transaction_id: claimed.order_id,
              payment_attempt_id: attempt.id,
              currency: attempt.currency || "USD",
              value: minorToDecimal(
                Number(attempt.amount || 0),
                attempt.currency || "USD"
              ),
              items: cartItems?.map((item) => ({
                item_id: item.variant_id || item.id,
                item_name: item.title || "Digital product",
                quantity: item.quantity || 1,
              })) || [
                {
                  item_id: "unknown_variant",
                  item_name: "Digital product",
                  quantity: 1,
                },
              ],
            },
            {
              dedupeKey: `purchase:${attempt.id}:${claimed.order_id}`,
            }
          )
          clearPendingPaymentState()
          setMessage("Payment confirmed. Your order is ready.")
          return
        }

        if (attempt.status === "failed" || attempt.status === "expired") {
          clearPendingPaymentState()
          setError(
            attempt.status === "expired"
              ? "This payment attempt expired. Create a new payment attempt."
              : "This payment attempt failed. Create a new payment attempt."
          )
          return
        }

        timeout = window.setTimeout(() => {
          void pollAttempt()
        }, 4000)
      } catch (err) {
        if (!active) {
          return
        }

        timeout = window.setTimeout(() => {
          void pollAttempt()
        }, 6000)
        setError(
          err instanceof Error ? err.message : "Failed to refresh payment."
        )
      } finally {
        if (active) {
          setClaiming(false)
        }
      }
    }

    void pollAttempt()

    return () => {
      active = false
      if (timeout) {
        window.clearTimeout(timeout)
      }
    }
  }, [
    cartItems,
    claimToken,
    orderAccessToken,
    paymentAttempt?.id,
    setClaiming,
    setError,
    setMessage,
    setOrderAccessToken,
    setPaymentAttempt,
    setResolvedMarketing,
  ])
}

function normalizeResolvedMarketing(value: unknown): MarketingResolvedContext | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return value as MarketingResolvedContext
}
