"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import {
  createCartPayment,
  listPaymentMethods,
  retrieveCurrentCustomerAccount,
  retrieveCart,
  retrievePaymentAttempt,
  updateCartEmail,
} from "@/lib/commerce"
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
import {
  persistPendingPaymentState,
  readPendingPaymentState,
} from "./checkout-pending-payment-storage"
import { readInitialOrderAccessToken } from "./order-access-token-storage"
import { useCheckoutPaymentClaim } from "./use-checkout-payment-claim"

const CART_ID_KEY = "store_cart_id"

export function CheckoutView() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [email, setEmail] = useState("")
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod["code"] | "">("")
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
      const lastOrderAccessToken = readInitialOrderAccessToken()
      const pendingPaymentState = readPendingPaymentState()

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
          const methods = await listPaymentMethods({
            amount: nextCart.total,
            currency: nextCart.currency_code,
          })
          setPaymentMethods(methods)
          setPaymentMethod((current) =>
            methods.some((method) => method.code === current)
              ? current
              : methods[0]?.code || ""
          )
        }

        if (pendingPaymentState.instructions) {
          setInstructions(
            JSON.parse(pendingPaymentState.instructions) as ManualPaymentInstructions
          )
        }

        if (pendingPaymentState.attemptId) {
          const { attempt } = await retrievePaymentAttempt(
            pendingPaymentState.attemptId
          )
          setPaymentAttempt(attempt)
          setResolvedMarketing(
            normalizeResolvedMarketing(attempt.marketing_context)
          )
        }

        if (pendingPaymentState.claimToken) {
          setClaimToken(pendingPaymentState.claimToken)
        }

        if (!cartId) {
          return
        }

        const account = await retrieveCurrentCustomerAccount().catch(() => null)
        setEmail((current) => current || account?.email || "")
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

  useCheckoutPaymentClaim({
    cartItems: cart?.items,
    claimToken,
    orderAccessToken,
    paymentAttempt,
    setClaiming,
    setError,
    setMessage,
    setOrderAccessToken,
    setPaymentAttempt,
    setResolvedMarketing,
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!cart) {
      return
    }

    if (!paymentMethod) {
      setError("Choose a payment method before creating payment.")
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
    return (
      <div className="theme-panel p-6 text-sm opacity-70">
        Loading checkout...
      </div>
    )
  }

  if (!cart?.items?.length) {
    return (
      <div className="theme-panel grid gap-5 p-8">
        <div>
          <h2 className="text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-sm leading-6 opacity-70">
            Add products before starting guest checkout.
          </p>
        </div>
        <Link
          href="/products"
          className="theme-primary-action inline-flex min-h-12 w-fit items-center px-5 text-sm font-semibold"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form
        onSubmit={handleSubmit}
        className="theme-panel space-y-7 p-6 shadow-[var(--shadow-card)]"
      >
        <section>
          <div className="flex items-center gap-3">
            <span className="theme-accent-action flex h-8 w-8 items-center justify-center text-sm font-semibold">
              1
            </span>
            <h2 className="text-lg font-semibold">Guest details</h2>
          </div>
          <label className="mt-4 block text-sm font-medium" htmlFor="email">
            Email for order access
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="theme-input mt-2 w-full px-3 py-3"
            placeholder="buyer@example.com"
          />
          <p className="mt-2 text-sm opacity-70">
            No account or password is required. Signed-in accounts can reuse the
            account email and see matching orders later.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="theme-accent-action flex h-8 w-8 items-center justify-center text-sm font-semibold">
              2
            </span>
            <h2 className="text-lg font-semibold">Payment method</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {paymentMethods.map((method) => (
              <label
                key={method.code}
                className="theme-field-row flex cursor-pointer items-center justify-between gap-4 p-4"
              >
                <span>
                  <span className="block font-medium">
                    {method.display_name}
                  </span>
                  <span className="mt-1 block text-xs opacity-60">
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
            {!paymentMethods.length ? (
              <p className="theme-muted-surface rounded-[var(--radius)] p-4 text-sm">
                No payment methods are available for this cart.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-sm opacity-70">
            Choose an available payment method for this order.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-3">
            <span className="theme-accent-action flex h-8 w-8 items-center justify-center text-sm font-semibold">
              3
            </span>
            <h2 className="text-lg font-semibold">Marketing (optional)</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="coupon_code">
                Coupon code
              </label>
              <input
                id="coupon_code"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                className="theme-input mt-2 w-full px-3 py-3"
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
                className="theme-input mt-2 w-full px-3 py-3"
                placeholder="CREATOR_A"
              />
            </div>
          </div>
          {Object.values(utmContext).some(Boolean) ? (
            <p className="mt-3 text-sm opacity-70">
              UTM captured: {utmContext.utm_source || "-"} /{" "}
              {utmContext.utm_medium || "-"} / {utmContext.utm_campaign || "-"}
            </p>
          ) : null}
        </section>

        <button
          type="submit"
          disabled={saving || !paymentMethod || !paymentMethods.length}
          className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create payment"}
        </button>

        {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        {paymentAttempt && instructions ? (
          <section className="theme-status-success rounded-[var(--radius)] p-4">
            <h2 className="text-base font-semibold">
              {instructions.title}
            </h2>
            <p className="mt-2 text-sm leading-6">
              {instructions.body}
            </p>
            <div className="theme-panel mt-3 p-3 text-sm shadow-none">
              <span className="block opacity-70">Payment reference</span>
              <span className="mt-1 block font-mono font-semibold">
                {instructions.reference}
              </span>
            </div>
            <p className="mt-3 text-sm">
              Attempt ID: {paymentAttempt.id}
            </p>
            <p className="mt-1 text-sm">
              Status: {paymentAttempt.status}
              {claiming ? " | Claiming order access..." : ""}
            </p>
          </section>
        ) : null}

        {resolvedMarketing ? (
          <section className="theme-muted-surface rounded-[var(--radius)] p-4">
            <h2 className="text-base font-semibold">
              Applied marketing context
            </h2>
            <div className="mt-3 space-y-2 text-sm opacity-75">
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
          <section className="theme-primary-action p-4">
            <h2 className="text-base font-semibold">Order ready</h2>
            <p className="mt-2 text-sm opacity-75">
              Your payment was confirmed and this browser stored the order access
              token.
            </p>
            <Link
              href="/orders"
              className="theme-secondary-action mt-4 inline-flex min-h-11 items-center px-4 text-sm font-semibold"
            >
              View order
            </Link>
          </section>
        ) : null}
      </form>

      <aside className="theme-panel h-fit p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm leading-6">
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
        <div className="theme-border mt-5 flex items-center justify-between border-t pt-5">
          <span>Total</span>
          <span className="font-semibold">
            {formatMoney(cart.total, cart.currency_code)}
          </span>
        </div>
      </aside>
    </div>
  )
}

function normalizeResolvedMarketing(value: unknown): MarketingResolvedContext | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return value as MarketingResolvedContext
}
