"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  deleteLineItem,
  retrieveCart,
  updateLineItem,
} from "@/lib/commerce"
import { formatMoney } from "@/lib/format"
import { emitStoreAnalyticsEvent, minorToDecimal } from "@/lib/analytics"
import type { SiteExperienceSectionConfig } from "@/lib/site-config"
import type { Cart } from "@/lib/types"
import { renderConfiguredSections, sectionAttributes } from "@/sections/shared"

const CART_ID_KEY = "store_cart_id"

type CartViewProps = {
  sections?: SiteExperienceSectionConfig[]
}

const DEFAULT_CART_SECTIONS: SiteExperienceSectionConfig[] = [
  {
    type: "cart-items",
    variant: "editable-list",
    enabled: true,
  },
  {
    type: "cart-summary",
    variant: "checkout-cta",
    enabled: true,
  },
]

export function CartView({ sections = DEFAULT_CART_SECTIONS }: CartViewProps) {
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
    return (
      <div className="theme-panel p-6 text-sm opacity-70">Loading cart...</div>
    )
  }

  if (error) {
    return <div className="theme-panel p-6 text-sm text-[var(--danger)]">{error}</div>
  }

  if (!cart?.items?.length) {
    return (
      <div className="theme-panel grid gap-5 p-8">
        <div>
          <h2 className="text-xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-sm leading-6 opacity-70">
            Add a digital product, then come back here to review checkout.
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
      {renderConfiguredSections(sections, (section) => {
        if (section.type === "cart-items") {
          return (
            <section {...sectionAttributes(section)} className="space-y-4">
              {cart.items?.map((item) => (
                <div
                  key={item.id}
                  className="theme-panel grid gap-4 p-4 sm:grid-cols-[96px_1fr_190px] sm:items-center"
                >
                  <div className="theme-muted-surface relative aspect-square overflow-hidden">
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={item.title}
                        fill
                        sizes="96px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="theme-accent-surface flex h-full items-center justify-center text-2xl font-semibold">
                        {item.title.slice(0, 1)}
                      </div>
                    )}
                  </div>
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
                    <div className="theme-field-row flex h-10 items-center">
                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(item.id, item.quantity - 1)
                        }
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
                        onClick={() =>
                          changeQuantity(item.id, item.quantity + 1)
                        }
                        className="h-full w-10 text-lg"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.id, 0)}
                      className="text-sm font-semibold text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )
        }

        if (section.type === "cart-summary") {
          return (
            <aside
              {...sectionAttributes(section)}
              className="theme-panel h-fit p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-24"
            >
              <h2 className="text-lg font-semibold">Order summary</h2>
              <div className="theme-border mt-5 flex items-center justify-between border-t pt-5">
                <span>Total</span>
                <span className="font-semibold">
                  {formatMoney(cart.total, cart.currency_code)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="theme-primary-action mt-5 flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold"
              >
                Continue to checkout
              </Link>
            </aside>
          )
        }

        return null
      })}
    </div>
  )
}
