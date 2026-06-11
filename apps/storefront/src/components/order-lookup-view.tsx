"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
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
} from "@/lib/commerce"
import type {
  AfterSale,
  DeliveryLookupResult,
  OrderDeliveryLookupResult,
  OrderLookupResult,
} from "@/lib/types"
import {
  consumeOrderAccessTokenFromUrl,
  persistOrderAccessToken,
  readInitialOrderAccessToken,
} from "./order-access-token-storage"

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
  const [initialAccessToken] = useState(readInitialOrderAccessToken)
  const [accessToken, setAccessToken] = useState(initialAccessToken)
  const autoLoadedTokenRef = useRef("")
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
    const tokenInUrl = consumeOrderAccessTokenFromUrl()

    if (tokenInUrl) {
      const syncTokenFromUrl = () => {
        setAccessToken(tokenInUrl)

        if (autoLoadedTokenRef.current !== tokenInUrl) {
          autoLoadedTokenRef.current = tokenInUrl
          void loadLookup(tokenInUrl)
        }
      }

      syncTokenFromUrl()
    }
  }, [searchParams])

  useEffect(() => {
    if (
      !initialAccessToken ||
      autoLoadedTokenRef.current === initialAccessToken
    ) {
      return
    }

    autoLoadedTokenRef.current = initialAccessToken
    void loadLookup(initialAccessToken)
  }, [initialAccessToken])

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
      persistOrderAccessToken(verified.access_token)
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
        className="theme-panel space-y-5 p-6 shadow-[var(--shadow-card)]"
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="access-token">
            Order access token
          </label>
          <input
            id="access-token"
            value={accessToken}
            onChange={(event) => {
              setAccessToken(event.target.value)
            }}
            required
            className="theme-input mt-2 w-full px-3 py-3 font-mono text-sm"
            placeholder="ord_... or dlv_..."
          />
          <p className="mt-2 text-sm opacity-70">
            Order tokens are the primary access path. Legacy delivery tokens are
            still accepted.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Loading..." : "View order"}
        </button>
        {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>

      <section className="theme-panel grid gap-6 p-6 shadow-[var(--shadow-card)] lg:grid-cols-2">
        <form onSubmit={handleRecover} className="space-y-4">
          <h2 className="text-base font-semibold">Recover order access</h2>
          <input
            type="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            required
            className="theme-input w-full px-3 py-3 text-sm"
            placeholder="buyer@example.com"
          />
          <input
            value={recoveryOrderId}
            onChange={(event) => setRecoveryOrderId(event.target.value)}
            required
            className="theme-input w-full px-3 py-3 font-mono text-sm"
            placeholder="order_..."
          />
          <button
            type="submit"
            disabled={recovering}
            className="theme-secondary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
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
            className="theme-input w-full px-3 py-3 font-mono text-sm"
            placeholder="order_..."
          />
          <input
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value)}
            required
            className="theme-input w-full px-3 py-3 font-mono text-sm"
            placeholder="123456"
          />
          <button
            type="submit"
            disabled={verifyingRecovery}
            className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
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
        <section className="theme-panel space-y-5 p-6 shadow-[var(--shadow-card)]">
          <div className="theme-border border-b pb-4">
            <h2 className="text-lg font-semibold">Order</h2>
            <p className="mt-1 text-sm opacity-70">
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
                <article key={item.delivery.id} className="theme-panel p-4 shadow-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{item.delivery.id}</h3>
                      <p className="text-sm opacity-70">
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
                      className="theme-primary-action min-h-10 px-4 text-sm font-semibold disabled:opacity-50"
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
                  <pre className="theme-code-block mt-4 overflow-auto p-4 text-sm leading-6">
                    {formatPayload(item.payload)}
                  </pre>
                </article>
              ))
            ) : (
              <p className="text-sm opacity-70">
                Payment is confirmed, but no delivery has been created yet.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {lookup ? (
        <section className="theme-panel p-6 shadow-[var(--shadow-card)]">
          <form onSubmit={handleAfterSaleSubmit} className="space-y-4">
            <h2 className="text-base font-semibold">After-sales request</h2>
            {lookup.kind === "order" && orderDeliveries.length ? (
                <select
                value={effectiveAfterSaleDeliveryId}
                onChange={(event) => setAfterSaleDeliveryId(event.target.value)}
                className="theme-input w-full px-3 py-3 text-sm"
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
                  className="theme-input mt-2 w-full px-3 py-3 text-sm"
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
                  className="theme-input mt-2 w-full px-3 py-3 text-sm"
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
                className="theme-input mt-2 min-h-28 w-full px-3 py-3 text-sm"
                placeholder="Describe the issue."
              />
            </div>
            <button
              type="submit"
              disabled={
                submittingAfterSale ||
                (lookup.kind === "order" && !effectiveAfterSaleDeliveryId)
              }
              className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
            >
              {submittingAfterSale ? "Submitting..." : "Submit request"}
            </button>
            {afterSale ? (
              <p className="text-sm text-[var(--success)]">
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
        persistOrderAccessToken(token)
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
    <section className="theme-panel p-6 shadow-[var(--shadow-card)]">
      <div className="theme-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Delivery</h2>
          <p className="mt-1 text-sm opacity-70">
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
          className="theme-primary-action min-h-10 px-4 text-sm font-semibold disabled:opacity-50"
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

      <pre className="theme-code-block mt-4 overflow-auto p-4 text-sm leading-6">
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
