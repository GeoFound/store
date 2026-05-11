"use client"

import { useEffect, useMemo, useState } from "react"
import { AddToCartButton } from "./add-to-cart-button"
import { formatMoney, getVariantPrice } from "@/lib/format"
import type { ProductTemplate, ProductVariant } from "@/lib/types"
import { emitStoreAnalyticsEvent, minorToDecimal } from "@/lib/analytics"

type ProductPurchasePanelProps = {
  productId: string
  productTitle: string
  template?: ProductTemplate
  variants?: ProductVariant[]
}

export function ProductPurchasePanel({
  productId,
  productTitle,
  template,
  variants = [],
}: ProductPurchasePanelProps) {
  const requiresInventory = useMemo(
    () => requiresInventoryTracking(template),
    [template]
  )
  const defaultVariant = useMemo(
    () => variants.find((variant) => !isVariantOutOfStock(variant)) || variants[0],
    [variants]
  )
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) || defaultVariant
  const { amount, currencyCode } = getVariantPrice(selectedVariant)
  const isSoldOut =
    !selectedVariant ||
    (requiresInventory && isVariantOutOfStock(selectedVariant))

  useEffect(() => {
    if (!selectedVariant?.id || typeof amount !== "number") {
      return
    }

    emitStoreAnalyticsEvent(
      "view_item",
      {
        currency: currencyCode,
        value: minorToDecimal(amount, currencyCode),
        items: [
          {
            item_id: selectedVariant.id,
            item_name: productTitle,
            item_variant: selectedVariant.title || selectedVariant.sku || "",
            quantity: 1,
          },
        ],
      },
      {
        dedupeKey: `view_item:${productId}:${selectedVariant.id}`,
      }
    )

  }, [
    amount,
    currencyCode,
    productId,
    productTitle,
    selectedVariant?.id,
    selectedVariant?.sku,
    selectedVariant?.title,
  ])

  return (
    <>
      <h1 className="mt-4 text-3xl font-semibold text-stone-950">
        {productTitle}
      </h1>
      <p className="mt-3 text-2xl font-semibold">
        {formatMoney(amount, currencyCode)}
      </p>

      {variants.length > 1 ? (
        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700" htmlFor="variant">
            Option
          </label>
          <select
            id="variant"
            className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-stone-950"
            value={selectedVariant?.id || ""}
            onChange={(event) => setSelectedVariantId(event.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {buildVariantLabel(variant, requiresInventory)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-3">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
            isSoldOut
              ? "bg-stone-950 text-white"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isSoldOut ? "Sold out" : "In stock"}
        </span>
      </div>

      <div className="mt-5 space-y-3 border-y border-stone-200 py-5 text-sm text-stone-700">
        <div className="flex justify-between gap-4">
          <span>Delivery</span>
          <span className="font-medium text-stone-950">
            {template?.deliveryLabel || "Digital"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Checkout</span>
          <span className="font-medium text-stone-950">Guest allowed</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Fulfillment</span>
          <span className="font-medium text-stone-950">
            {template?.title || "After payment"}
          </span>
        </div>
        {requiresInventory && typeof selectedVariant?.available_quantity === "number" ? (
          <div className="flex justify-between gap-4">
            <span>Available</span>
            <span className="font-medium text-stone-950">
              {selectedVariant.available_quantity}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <AddToCartButton
          variantId={selectedVariant?.id}
          disabled={isSoldOut}
          disabledLabel="Sold out"
          analyticsItem={{
            item_id: selectedVariant?.id,
            item_name: productTitle,
            currency: currencyCode,
            price_minor: amount,
          }}
        />
      </div>
    </>
  )
}

function isVariantOutOfStock(variant: ProductVariant) {
  return variant.is_in_stock === false || !variant.available_quantity
}

function buildVariantLabel(
  variant: ProductVariant,
  requiresInventory: boolean
) {
  const title =
    (typeof variant.title === "string" && variant.title.trim()) ||
    (typeof variant.sku === "string" && variant.sku.trim()) ||
    variant.id

  if (requiresInventory && typeof variant.available_quantity === "number") {
    return `${title} (${variant.available_quantity} available)`
  }

  return title
}

function requiresInventoryTracking(template?: ProductTemplate) {
  if (template?.inventoryHandlerCode) {
    return template.inventoryHandlerCode !== "noop"
  }

  return ["credential", "account", "license", "code"].includes(
    String(template?.code || template?.productType || "")
      .trim()
      .toLowerCase()
  )
}
