"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addLineItem, createCart } from "@/lib/medusa"
import { emitStoreAnalyticsEvent, minorToDecimal } from "@/lib/analytics"

const CART_ID_KEY = "store_cart_id"

type AddToCartButtonProps = {
  variantId?: string
  disabled?: boolean
  disabledLabel?: string
  analyticsItem?: {
    item_id?: string
    item_name?: string
    currency?: string
    price_minor?: number
  }
}

export function AddToCartButton({
  variantId,
  disabled = false,
  disabledLabel = "Sold out",
  analyticsItem,
}: AddToCartButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleAdd() {
    if (disabled) {
      setError("This product is currently sold out.")
      return
    }

    if (!variantId) {
      setError("This product has no sellable variant.")
      return
    }

    setLoading(true)
    setError("")

    try {
      let cartId = window.localStorage.getItem(CART_ID_KEY)

      if (!cartId) {
        const cart = await createCart()
        cartId = cart.id
        window.localStorage.setItem(CART_ID_KEY, cart.id)
      }

      await addLineItem({
        cartId,
        variantId,
        quantity: 1,
      })

      const currency = analyticsItem?.currency || "USD"
      emitStoreAnalyticsEvent(
        "add_to_cart",
        {
          currency,
          value: minorToDecimal(analyticsItem?.price_minor || 0, currency),
          items: [
            {
              item_id: analyticsItem?.item_id || variantId,
              item_name: analyticsItem?.item_name || "Digital product",
              quantity: 1,
            },
          ],
        },
        {
          dedupeKey: `add_to_cart:${variantId}:${cartId}`,
        }
      )

      router.push("/cart")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleAdd}
        disabled={loading || !variantId || disabled}
        className="w-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {loading ? "Adding..." : disabled ? disabledLabel : "Add to cart"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
