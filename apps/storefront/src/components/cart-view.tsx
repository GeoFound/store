"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  deleteLineItem,
  retrieveCart,
  updateLineItem,
} from "@/lib/medusa"
import { formatMoney } from "@/lib/format"
import { emitStoreAnalyticsEvent, minorToDecimal } from "@/lib/analytics"
import type { Cart } from "@/lib/types"

const CART_ID_KEY = "store_cart_id"

export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadCart() {
      const cartId = window.localStorage.getItem(CART_ID_KEY)

      if (!cartId) {
        setLoading(false)
        return
      }

      try {
        setCart(await retrieveCart(cartId))
      } catch (err) {
        window.localStorage.removeItem(CART_ID_KEY)
        setError(err instanceof Error ? err.message : "Failed to load cart.")
      } finally {
        setLoading(false)
      }
    }

    loadCart()
  }, [])

  useEffect(() => {
    if (!cart?.id || !cart.items?.length) {
      return
    }

    emitStoreAnalyticsEvent(
      "view_cart",
      {
        currency: cart.currency_code || "USD",
        value: minorToDecimal(cart.total || 0, cart.currency_code || "USD"),
        items: cart.items.map((item) => ({
          item_id: item.variant_id || item.id,
          item_name: item.title || "Digital product",
          quantity: item.quantity || 1,
        })),
      },
      {
        dedupeKey: `view_cart:${cart.id}:${cart.total || 0}`,
      }
    )
  }, [cart?.currency_code, cart?.id, cart?.items, cart?.total])

  async function changeQuantity(lineItemId: string, quantity: number) {
    if (!cart) {
      return
    }

    if (quantity < 1) {
      setCart(await deleteLineItem({ cartId: cart.id, lineItemId }))
      return
    }

    setCart(await updateLineItem({ cartId: cart.id, lineItemId, quantity }))
  }

  if (loading) {
    return <p className="text-sm opacity-70">Loading cart...</p>
  }

  if (error) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>
  }

  if (!cart?.items?.length) {
    return (
      <div className="theme-panel space-y-5 p-6">
        <p className="opacity-75">Your cart is empty.</p>
        <Link
          href="/products"
          className="theme-primary-action inline-flex px-4 py-3 text-sm font-semibold"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {cart.items.map((item) => (
          <div
            key={item.id}
            className="theme-panel grid gap-4 p-4 sm:grid-cols-[1fr_160px]"
          >
            <div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm opacity-70">
                {item.product_title || "Digital product"}
              </p>
              <p className="mt-3 text-sm font-medium">
                {formatMoney(item.unit_price, cart.currency_code)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="theme-border flex h-10 items-center border">
                <button
                  type="button"
                  onClick={() => changeQuantity(item.id, item.quantity - 1)}
                  className="h-full w-10 text-lg"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-10 text-center text-sm">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => changeQuantity(item.id, item.quantity + 1)}
                  className="h-full w-10 text-lg"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => changeQuantity(item.id, 0)}
                className="text-sm text-[var(--danger)]"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <aside className="theme-panel h-fit p-5">
        <h2 className="text-base font-semibold">Order summary</h2>
        <div className="theme-border mt-5 flex items-center justify-between border-t pt-4">
          <span>Total</span>
          <span className="font-semibold">
            {formatMoney(cart.total, cart.currency_code)}
          </span>
        </div>
        <Link
          href="/checkout"
          className="theme-primary-action mt-5 flex w-full items-center justify-center px-4 py-3 text-sm font-semibold"
        >
          Continue to checkout
        </Link>
      </aside>
    </div>
  )
}
