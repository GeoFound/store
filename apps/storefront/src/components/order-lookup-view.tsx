"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  confirmDelivery,
  confirmOrderDelivery,
  createAfterSale,
  createOrderAfterSale,
  recoverOrder,
  retrieveDelivery,
  retrieveOrder,
  verifyOrderRecovery,
} from "@/lib/medusa"
import type {
  AfterSale,
  DeliveryLookupResult,
  OrderDeliveryLookupResult,
  OrderLookupResult,
} from "@/lib/types"

const ORDER_ACCESS_TOKEN_SESSION_KEY = "store_session_order_access_token"
const LEGACY_ORDER_ACCESS_TOKEN_KEY = "store_last_order_access_token"

type LookupState =
  | {
      kind: "delivery"
      data: DeliveryLookupResult
    }
  | {
      kind: "order"
      data: OrderLookupResult
    }

export function OrderLookupView() {
  const searchParams = useSearchParams()
  const [accessToken, setAccessToken] = useState(() => {
    if (typeof window === "undefined") {
      return ""
    }

    const params = new URLSearchParams(window.location.search)
    const queryToken = params.get("access_token") || ""
    const sessionToken =
      window.sessionStorage.getItem(ORDER_ACCESS_TOKEN_SESSION_KEY) || ""
    const legacyToken =
      window.localStorage.getItem(LEGACY_ORDER_ACCESS_TOKEN_KEY) || ""
    const resolvedToken = queryToken || sessionToken || legacyToken

    if (resolvedToken) {
      window.sessionStorage.setItem(
        ORDER_ACCESS_TOKEN_SESSION_KEY,
        resolvedToken
      )
      window.localStorage.removeItem(LEGACY_ORDER_ACCESS_TOKEN_KEY)
    }

    return resolvedToken
  })
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmingDeliveryId, setConfirmingDeliveryId] = useState("")
  const [afterSaleEmail, setAfterSaleEmail] = useState("")
  const [afterSaleReason, setAfterSaleReason] =
    useState<AfterSale["reason"]>("not_working")
  const [afterSaleMessage, setAfterSaleMessage] = useState("")
  const [afterSaleDeliveryId, setAfterSaleDeliveryId] = useState("")
  const [afterSale, setAfterSale] = useState<AfterSale | null>(null)
  const [submittingAfterSale, setSubmittingAfterSale] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [recoveryOrderId, setRecoveryOrderId] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [recovering, setRecovering] = useState(false)
  const [verifyingRecovery, setVerifyingRecovery] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const orderDeliveries = useMemo(() => {
    if (lookup?.kind !== "order") {
      return []
    }

    return lookup.data.deliveries
  }, [lookup])
  const effectiveAfterSaleDeliveryId =
    afterSaleDeliveryId || orderDeliveries[0]?.delivery.id || ""

  useEffect(() => {
    const url = new URL(window.location.href)
    const tokenInQuery = url.searchParams.get("access_token")

    if (!tokenInQuery) {
      return
    }

    const normalizedToken = tokenInQuery.trim()

    if (normalizedToken) {
      window.sessionStorage.setItem(
        ORDER_ACCESS_TOKEN_SESSION_KEY,
        normalizedToken
      )
      window.localStorage.removeItem(LEGACY_ORDER_ACCESS_TOKEN_KEY)
    }

    url.searchParams.delete("access_token")
    const nextQuery = url.searchParams.toString()
    const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`
    window.history.replaceState({}, "", nextUrl)
  }, [searchParams])

  useEffect(() => {
    if (!accessToken || lookup) {
      return
    }

    void loadLookup(accessToken)
  }, [accessToken, lookup, searchParams])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadLookup(accessToken.trim())
  }

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setRecovering(true)
    setError("")
    setMessage("")

    try {
      const result = await recoverOrder({
        email: recoveryEmail.trim(),
        orderId: recoveryOrderId.trim(),
      })
      setMessage(
        result.expires_at
          ? `Recovery code sent. It expires at ${result.expires_at}.`
          : "Recovery code sent."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send recovery code.")
    } finally {
      setRecovering(false)
    }
  }

  async function handleVerifyRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setVerifyingRecovery(true)
    setError("")
    setMessage("")

    try {
      const verified = await verifyOrderRecovery({
        orderId: recoveryOrderId.trim(),
        code: recoveryCode.trim(),
      })
      window.sessionStorage.setItem(
        ORDER_ACCESS_TOKEN_SESSION_KEY,
        verified.access_token
      )
      window.localStorage.removeItem(LEGACY_ORDER_ACCESS_TOKEN_KEY)
      setAccessToken(verified.access_token)
      await loadLookup(verified.access_token)
      setMessage("Order access restored.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify recovery code.")
    } finally {
      setVerifyingRecovery(false)
    }
  }

  async function handleConfirm(deliveryId?: string) {
    if (!lookup) {
      return
    }

    const targetDeliveryId =
      deliveryId ||
      (lookup.kind === "delivery" ? lookup.data.delivery.id : afterSaleDeliveryId)

    if (!targetDeliveryId) {
      return
    }

    setConfirmingDeliveryId(targetDeliveryId)
    setError("")

    try {
      if (lookup.kind === "delivery") {
        const confirmed = await confirmDelivery(accessToken.trim())
        setLookup({
          kind: "delivery",
          data: {
            ...lookup.data,
            delivery: confirmed.delivery,
          },
        })
      } else {
        const confirmed = await confirmOrderDelivery({
          accessToken: accessToken.trim(),
          deliveryId: targetDeliveryId,
        })
        setLookup({
          kind: "order",
          data: {
            ...lookup.data,
            deliveries: lookup.data.deliveries.map((item) =>
              item.delivery.id === targetDeliveryId
                ? {
                    ...item,
                    delivery: confirmed.delivery,
                  }
                : item
            ),
          },
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm.")
    } finally {
      setConfirmingDeliveryId("")
    }
  }

  async function handleAfterSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!lookup) {
      return
    }

    setSubmittingAfterSale(true)
    setError("")

    try {
      const created =
        lookup.kind === "delivery"
          ? await createAfterSale({
              accessToken: accessToken.trim(),
              email: afterSaleEmail || undefined,
              reason: afterSaleReason,
              message: afterSaleMessage,
            })
          : await createOrderAfterSale({
              accessToken: accessToken.trim(),
              deliveryId: effectiveAfterSaleDeliveryId,
              email: afterSaleEmail || undefined,
              reason: afterSaleReason,
              message: afterSaleMessage,
            })
      setAfterSale(created.after_sale)
      setAfterSaleMessage("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit after-sales request."
      )
    } finally {
      setSubmittingAfterSale(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 border border-stone-200 bg-white p-5"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="access-token">
            Order access token
          </label>
          <input
            id="access-token"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            required
            className="mt-2 w-full border border-stone-300 px-3 py-3 font-mono text-sm outline-none focus:border-stone-950"
            placeholder="ord_... or dlv_..."
          />
          <p className="mt-2 text-sm text-stone-600">
            Order tokens are the primary access path. Legacy delivery tokens are
            still accepted.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
        >
          {loading ? "Loading..." : "View order"}
        </button>
        {message ? <p className="text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>

      <section className="grid gap-6 border border-stone-200 bg-white p-5 lg:grid-cols-2">
        <form onSubmit={handleRecover} className="space-y-4">
          <h2 className="text-base font-semibold">Recover order access</h2>
          <input
            type="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            required
            className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-950"
            placeholder="buyer@example.com"
          />
          <input
            value={recoveryOrderId}
            onChange={(event) => setRecoveryOrderId(event.target.value)}
            required
            className="w-full border border-stone-300 px-3 py-3 font-mono text-sm outline-none focus:border-stone-950"
            placeholder="order_..."
          />
          <button
            type="submit"
            disabled={recovering}
            className="w-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-950 disabled:border-stone-200 disabled:text-stone-400"
          >
            {recovering ? "Sending..." : "Send recovery code"}
          </button>
        </form>

        <form onSubmit={handleVerifyRecovery} className="space-y-4">
          <h2 className="text-base font-semibold">Verify recovery code</h2>
          <input
            value={recoveryOrderId}
            onChange={(event) => setRecoveryOrderId(event.target.value)}
            required
            className="w-full border border-stone-300 px-3 py-3 font-mono text-sm outline-none focus:border-stone-950"
            placeholder="order_..."
          />
          <input
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value)}
            required
            className="w-full border border-stone-300 px-3 py-3 font-mono text-sm outline-none focus:border-stone-950"
            placeholder="123456"
          />
          <button
            type="submit"
            disabled={verifyingRecovery}
            className="w-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
          >
            {verifyingRecovery ? "Verifying..." : "Restore access"}
          </button>
        </form>
      </section>

      {lookup?.kind === "delivery" ? (
        <DeliveryPanel
          result={lookup.data}
          confirming={confirmingDeliveryId === lookup.data.delivery.id}
          onConfirm={() => void handleConfirm(lookup.data.delivery.id)}
        />
      ) : null}

      {lookup?.kind === "order" ? (
        <section className="space-y-5 border border-stone-200 bg-white p-5">
          <div className="border-b border-stone-200 pb-4">
            <h2 className="text-lg font-semibold">Order</h2>
            <p className="mt-1 text-sm text-stone-600">
              {lookup.data.order.custom_display_id ||
                (lookup.data.order.display_id
                  ? `#${lookup.data.order.display_id}`
                  : lookup.data.order.id)}
              {" · "}
              {lookup.data.order.status}
            </p>
          </div>

          <div className="space-y-4">
            {lookup.data.deliveries.length ? (
              lookup.data.deliveries.map((item) => (
                <article key={item.delivery.id} className="border border-stone-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{item.delivery.id}</h3>
                      <p className="text-sm text-stone-600">
                        Status: {item.delivery.delivery_status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleConfirm(item.delivery.id)}
                      disabled={
                        confirmingDeliveryId === item.delivery.id ||
                        item.delivery.delivery_status !== "delivered"
                      }
                      className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-400"
                    >
                      {confirmingDeliveryId === item.delivery.id
                        ? "Confirming..."
                        : item.delivery.delivery_status === "pending"
                          ? "Pending fulfillment"
                          : item.delivery.delivery_status === "confirmed"
                            ? "Confirmed"
                            : "Confirm received"}
                    </button>
                  </div>
                  <pre className="mt-4 overflow-auto bg-stone-950 p-4 text-sm leading-6 text-stone-50">
                    {formatPayload(item.payload)}
                  </pre>
                </article>
              ))
            ) : (
              <p className="text-sm text-stone-600">
                Payment is confirmed, but no delivery has been created yet.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {lookup ? (
        <section className="border border-stone-200 bg-white p-5">
          <form onSubmit={handleAfterSaleSubmit} className="space-y-4">
            <h2 className="text-base font-semibold">After-sales request</h2>
            {lookup.kind === "order" && orderDeliveries.length ? (
                <select
                value={effectiveAfterSaleDeliveryId}
                onChange={(event) => setAfterSaleDeliveryId(event.target.value)}
                className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-950"
              >
                {orderDeliveries.map((item) => (
                  <option key={item.delivery.id} value={item.delivery.id}>
                    {item.delivery.id} · {item.delivery.delivery_status}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-medium"
                  htmlFor="after-sale-email"
                >
                  Email
                </label>
                <input
                  id="after-sale-email"
                  type="email"
                  value={afterSaleEmail}
                  onChange={(event) => setAfterSaleEmail(event.target.value)}
                  className="mt-2 w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-950"
                  placeholder="buyer@example.com"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium"
                  htmlFor="after-sale-reason"
                >
                  Reason
                </label>
                <select
                  id="after-sale-reason"
                  value={afterSaleReason}
                  onChange={(event) =>
                    setAfterSaleReason(event.target.value as AfterSale["reason"])
                  }
                  className="mt-2 w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-950"
                >
                  <option value="not_working">Not working</option>
                  <option value="wrong_item">Wrong item</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="refund">Refund</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label
                className="block text-sm font-medium"
                htmlFor="after-sale-message"
              >
                Message
              </label>
              <textarea
                id="after-sale-message"
                required
                value={afterSaleMessage}
                onChange={(event) => setAfterSaleMessage(event.target.value)}
                className="mt-2 min-h-28 w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-stone-950"
                placeholder="Describe the issue."
              />
            </div>
            <button
              type="submit"
              disabled={
                submittingAfterSale ||
                (lookup.kind === "order" && !effectiveAfterSaleDeliveryId)
              }
              className="w-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-400"
            >
              {submittingAfterSale ? "Submitting..." : "Submit request"}
            </button>
            {afterSale ? (
              <p className="text-sm text-teal-700">
                After-sales request created: {afterSale.id}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  )

  async function loadLookup(token: string) {
    if (!token) {
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      if (token.startsWith("dlv_")) {
        setLookup({
          kind: "delivery",
          data: await retrieveDelivery(token),
        })
      } else {
        const result = await retrieveOrder(token)
        setLookup({
          kind: "order",
          data: result,
        })
        window.sessionStorage.setItem(ORDER_ACCESS_TOKEN_SESSION_KEY, token)
        window.localStorage.removeItem(LEGACY_ORDER_ACCESS_TOKEN_KEY)
      }
      setAfterSale(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order was not found.")
      setLookup(null)
    } finally {
      setLoading(false)
    }
  }
}

function DeliveryPanel(input: {
  result: DeliveryLookupResult
  confirming: boolean
  onConfirm: () => void
}) {
  return (
    <section className="border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-2 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Delivery</h2>
          <p className="mt-1 text-sm text-stone-600">
            Status: {input.result.delivery.delivery_status}
          </p>
        </div>
        <button
          type="button"
          onClick={input.onConfirm}
          disabled={
            input.confirming ||
            input.result.delivery.delivery_status !== "delivered"
          }
          className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-400"
        >
          {input.confirming
            ? "Confirming..."
            : input.result.delivery.delivery_status === "pending"
              ? "Pending fulfillment"
              : input.result.delivery.delivery_status === "confirmed"
                ? "Confirmed"
                : "Confirm received"}
        </button>
      </div>

      <pre className="mt-4 overflow-auto bg-stone-950 p-4 text-sm leading-6 text-stone-50">
        {formatPayload(input.result.payload)}
      </pre>
    </section>
  )
}

function formatPayload(payload: OrderDeliveryLookupResult["payload"]) {
  if (typeof payload === "string") {
    return payload
  }

  return JSON.stringify(payload, null, 2)
}
