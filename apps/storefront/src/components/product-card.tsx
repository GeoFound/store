import Image from "next/image"
import Link from "next/link"
import { formatMoney, getVariantPrice } from "@/lib/format"
import type { Product } from "@/lib/types"

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const template = product.template
  const isSoldOut = product.isSoldOut
  const variant = pickDisplayVariant(product.variants, isSoldOut)
  const { amount, currencyCode } = getVariantPrice(variant)

  return (
    <Link
      href={`/products/${product.handle}`}
      className="theme-card group block overflow-hidden"
    >
      <div className="theme-muted-surface relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-white to-[var(--surface-muted)]">
        {isSoldOut ? (
          <div className="theme-status-danger absolute left-3 top-3 z-10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
            Sold out
          </div>
        ) : null}
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-6 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="theme-accent-surface flex h-full items-center justify-center text-5xl font-semibold">
            {product.title.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold leading-6">
            {product.title}
          </h3>
          <p className="mt-1.5 text-sm leading-5 opacity-70">
            {template?.deliveryLabel || "Digital delivery after payment"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">
            {formatMoney(amount, currencyCode)}
          </span>
          <span
            className={`text-sm font-semibold ${
              isSoldOut ? "opacity-60" : "theme-accent-text"
            }`}
          >
            {isSoldOut ? "Unavailable" : template?.title || "View"}
          </span>
        </div>
      </div>
    </Link>
  )
}

function pickDisplayVariant(
  variants: Product["variants"],
  isSoldOut?: boolean
) {
  if (!variants?.length) {
    return undefined
  }

  if (isSoldOut) {
    return variants[0]
  }

  return (
    variants.find((variant) => isVariantPurchasable(variant)) ||
    variants[0]
  )
}

function isVariantPurchasable(
  variant: NonNullable<Product["variants"]>[number]
) {
  if (typeof variant.purchase_available === "boolean") {
    return variant.purchase_available
  }

  return variant.is_in_stock !== false && Boolean(variant.available_quantity)
}
