"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import {
  claimOrderAccess,
  createCartPayment,
  listPaymentMethods,
  retrieveCart,
  retrievePaymentAttempt,
  updateCartEmail,
} from "@/lib/medusa"
import { formatMoney } from "@/lib/format"
import {
  emitStoreAnalyticsEvent,
  getCheckoutAnalyticsContext,
  minorToDecimal,
} from "@/lib/analytics"
import type {
  Cart,
  MarketingResolvedContext,
  ManualPaymentInstructions,
  PaymentAttempt,
  PaymentMethod,
} from "@/lib/types"

const CART_ID_KEY = "store_cart_id"
const ORDER_ACCESS_TOKEN_KEY = "store_last_order_access_token"
const PENDING_PAYMENT_ATTEMPT_ID_KEY = "store_pending_payment_attempt_id"
const PENDING_PAYMENT_CLAIM_TOKEN_KEY = "store_pending_payment_claim_token"
const PENDING_PAYMENT_INSTRUCTIONS_KEY = "store_pending_payment_instructions"

export function CheckoutView() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [email, setEmail] = useState("")
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod["code"]>("manual")
  const [paymentAttempt, setPaymentAttempt] = useState<PaymentAttempt | null>(
    null
  )
  const [instructions, setInstructions] =
    useState<ManualPaymentInstructions | null>(null)
  const [resolvedMarketing, setResolvedMarketing] =
    useState<MarketingResolvedContext | null>(null)
  const [claimToken, setClaimToken] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [utmContext, setUtmContext] = useState({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
  })
  const [orderAccessToken, setOrderAccessToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadCheckoutState() {
      const cartId = window.localStorage.getItem(CART_ID_KEY)
      const lastOrderAccessToken = window.localStorage.getItem(
        ORDER_ACCESS_TOKEN_KEY
      )
      const pendingAttemptId = window.localStorage.getItem(
        PENDING_PAYMENT_ATTEMPT_ID_KEY
      )
      const pendingClaimToken = window.localStorage.getItem(
        PENDING_PAYMENT_CLAIM_TOKEN_KEY
      )
      const storedInstructions = window.localStorage.getItem(
        PENDING_PAYMENT_INSTRUCTIONS_KEY
      )

      if (lastOrderAccessToken) {
        setOrderAccessToken(lastOrderAccessToken)
      }

      try {
        const url = new URL(window.location.href)
        setUtmContext({
          utm_source: url.searchParams.get("utm_source") || "",
          utm_medium: url.searchParams.get("utm_medium") || "",
          utm_campaign: url.searchParams.get("utm_campaign") || "",
          utm_content: url.searchParams.get("utm_content") || "",
          utm_term: url.searchParams.get("utm_term") || "",
        })

        if (cartId) {
          const nextCart = await retrieveCart(cartId)
          setCart(nextCart)
          setEmail(nextCart.email || "")
          setPaymentMethods(
            await listPaymentMethods({
              amount: nextCart.total,
              currency: nextCart.currency_code,
            })
          )
        }

        if (storedInstructions) {
          setInstructions(
            JSON.parse(storedInstructions) as ManualPaymentInstructions
          )
        }

        if (pendingAttemptId) {
          const { attempt } = await retrievePaymentAttempt(pendingAttemptId)
          setPaymentAttempt(attempt)
          setResolvedMarketing(
            normalizeResolvedMarketing(attempt.marketing_context)
          )
        }

        if (pendingClaimToken) {
          setClaimToken(pendingClaimToken)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cart.")
      } finally {
        setLoading(false)
      }
    }

    void loadCheckoutState()
  }, [])

  useEffect(() => {
    if (!cart?.id || !Array.isArray(cart.items) || !cart.items.length) {
      return
    }

    emitStoreAnalyticsEvent(
      "begin_checkout",
      {
        currency: cart.currency_code || "USD",
        value: minorToDecimal(cart.total || 0, cart.currency_code || "USD"),
        items: cart.items.map((item) => ({
          item_id: item.variant_id || item.id,
          item_name: item.title || "Digital product",
          quantity: item.quantity || 1,
          price: minorToDecimal(item.unit_price || 0, cart.currency_code || "USD"),
        })),
      },
      {
        dedupeKey: `begin_checkout:${cart.id}:${cart.total || 0}`,
      }
    )
  }, [cart?.currency_code, cart?.id, cart?.items, cart?.total])

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
          window.localStorage.setItem(
            ORDER_ACCESS_TOKEN_KEY,
            claimed.access_token
          )
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
              items: cart?.items?.map((item) => ({
                item_id: item.variant_id || item.id,
                item_name: item.title || "Digital product",
                quantity: item.quantity || 1,
              })) || [{ item_id: "unknown_variant", item_name: "Digital product", quantity: 1 }],
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
        setError(err instanceof Error ? err.message : "Failed to refresh payment.")
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
  }, [cart?.items, claimToken, orderAccessToken, paymentAttempt?.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!cart) {
      return
    }

    setSaving(true)
    setError("")
    setMessage("")

    try {
      const nextCart = await updateCartEmail({
        cartId: cart.id,
        email,
      })
      const payment = await createCartPayment({
        cartId: nextCart.id,
        paymentMethod,
        marketing: {
          coupon_code: couponCode || undefined,
          referral_code: referralCode || undefined,
          utm_source: utmContext.utm_source || undefined,
          utm_medium: utmContext.utm_medium || undefined,
          utm_campaign: utmContext.utm_campaign || undefined,
          utm_content: utmContext.utm_content || undefined,
          utm_term: utmContext.utm_term || undefined,
        },
        analytics: getCheckoutAnalyticsContext(),
      })

      setCart(nextCart)
      setPaymentAttempt(payment.attempt)
      setInstructions(payment.instructions)
      setResolvedMarketing(
        normalizeResolvedMarketing(
          payment.marketing || payment.attempt.marketing_context
        )
      )
      setClaimToken(payment.claim_token)
      setOrderAccessToken("")
      persistPendingPaymentState(
        payment.attempt.id,
        payment.claim_token,
        payment.instructions
      )
      setMessage("Payment attempt created. Keep the reference until payment is confirmed.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save checkout.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-600">Loading checkout...</p>
  }

  if (!cart?.items?.length) {
    return (
      <div className="space-y-5 border border-stone-200 bg-white p-6">
        <p className="text-stone-700">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 border border-stone-200 bg-white p-5"
      >
        <section>
          <h2 className="text-lg font-semibold">Guest details</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="email">
            Email for order access
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-stone-950"
            placeholder="buyer@example.com"
          />
          <p className="mt-2 text-sm text-stone-600">
            No account or password is required. This email is used for receipt,
            order recovery, and secure order access.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Payment method</h2>
          <div className="mt-4 grid gap-3">
            {paymentMethods.map((method) => (
              <label
                key={method.code}
                className="flex cursor-pointer items-center justify-between border border-stone-300 p-4"
              >
                <span>
                  <span className="block font-medium">
                    {method.display_name}
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {method.health_status}
                  </span>
                </span>
                <input
                  type="radio"
                  name="payment_method"
                  value={method.code}
                  checked={paymentMethod === method.code}
                  onChange={() => setPaymentMethod(method.code)}
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-stone-600">
            Payment providers are isolated behind the payment-router module.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Marketing (optional)</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="coupon_code">
                Coupon code
              </label>
              <input
                id="coupon_code"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-stone-950"
                placeholder="SAVE10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="referral_code">
                Referral code
              </label>
              <input
                id="referral_code"
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
                className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-stone-950"
                placeholder="CREATOR_A"
              />
            </div>
          </div>
          {Object.values(utmContext).some(Boolean) ? (
            <p className="mt-3 text-sm text-stone-600">
              UTM captured: {utmContext.utm_source || "-"} /{" "}
              {utmContext.utm_medium || "-"} / {utmContext.utm_campaign || "-"}
            </p>
          ) : null}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:bg-stone-400"
        >
          {saving ? "Creating..." : "Create payment"}
        </button>

        {message ? <p className="text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {paymentAttempt && instructions ? (
          <section className="border border-teal-700 bg-teal-50 p-4">
            <h2 className="text-base font-semibold text-teal-950">
              {instructions.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-teal-900">
              {instructions.body}
            </p>
            <div className="mt-3 border border-teal-200 bg-white p-3 text-sm">
              <span className="block text-stone-600">Payment reference</span>
              <span className="mt-1 block font-mono font-semibold">
                {instructions.reference}
              </span>
            </div>
            <p className="mt-3 text-sm text-teal-900">
              Attempt ID: {paymentAttempt.id}
            </p>
            <p className="mt-1 text-sm text-teal-900">
              Status: {paymentAttempt.status}
              {claiming ? " | Claiming order access..." : ""}
            </p>
          </section>
        ) : null}

        {resolvedMarketing ? (
          <section className="border border-stone-200 bg-stone-50 p-4">
            <h2 className="text-base font-semibold text-stone-900">
              Applied marketing context
            </h2>
            <div className="mt-3 space-y-2 text-sm text-stone-700">
              {resolvedMarketing.coupon?.code ? (
                <p>Coupon: {resolvedMarketing.coupon.code}</p>
              ) : null}
              {resolvedMarketing.referral?.code ? (
                <p>Referral: {resolvedMarketing.referral.code}</p>
              ) : null}
              {resolvedMarketing.attribution?.source ||
              resolvedMarketing.attribution?.campaign ? (
                <p>
                  Attribution: {resolvedMarketing.attribution?.source || "-"} /{" "}
                  {resolvedMarketing.attribution?.medium || "-"} /{" "}
                  {resolvedMarketing.attribution?.campaign || "-"}
                </p>
              ) : null}
              {resolvedMarketing.tags?.length ? (
                <p>Tags: {resolvedMarketing.tags.join(", ")}</p>
              ) : null}
              {resolvedMarketing.warnings?.length ? (
                <p>Warnings: {resolvedMarketing.warnings.join(", ")}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {orderAccessToken ? (
          <section className="border border-stone-950 bg-stone-950 p-4 text-white">
            <h2 className="text-base font-semibold">Order ready</h2>
            <p className="mt-2 text-sm text-stone-200">
              Your payment was confirmed and this browser stored the order access
              token.
            </p>
            <Link
              href={`/orders?access_token=${encodeURIComponent(orderAccessToken)}`}
              className="mt-4 inline-flex bg-white px-4 py-3 text-sm font-semibold text-stone-950"
            >
              View order
            </Link>
          </section>
        ) : null}
      </form>

      <aside className="h-fit border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold">Order summary</h2>
        <div className="mt-4 space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm">
              <span>
                {item.title} x {item.quantity}
              </span>
              <span>
                {formatMoney(
                  item.total ?? item.unit_price * item.quantity,
                  cart.currency_code
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4">
          <span>Total</span>
          <span className="font-semibold">
            {formatMoney(cart.total, cart.currency_code)}
          </span>
        </div>
      </aside>
    </div>
  )
}

function persistPendingPaymentState(
  attemptId: string,
  claimToken: string,
  instructions: ManualPaymentInstructions | null
) {
  window.localStorage.setItem(PENDING_PAYMENT_ATTEMPT_ID_KEY, attemptId)
  window.localStorage.setItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY, claimToken)

  if (instructions) {
    window.localStorage.setItem(
      PENDING_PAYMENT_INSTRUCTIONS_KEY,
      JSON.stringify(instructions)
    )
  }
}

function clearPendingPaymentState() {
  window.localStorage.removeItem(PENDING_PAYMENT_ATTEMPT_ID_KEY)
  window.localStorage.removeItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY)
  window.localStorage.removeItem(PENDING_PAYMENT_INSTRUCTIONS_KEY)
}

function normalizeResolvedMarketing(value: unknown): MarketingResolvedContext | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return value as MarketingResolvedContext
}
