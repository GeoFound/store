import type { Product } from "@/lib/types"
import { ProductCard } from "./product-card"

type ProductGridProps = {
  products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="theme-panel grid gap-3 border-dashed p-8 text-sm">
        <h2 className="text-lg font-semibold">No products available</h2>
        <p className="max-w-xl leading-6 opacity-70">
          Add products in Medusa Admin and refresh the storefront. This area is
          ready for live catalog data.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
