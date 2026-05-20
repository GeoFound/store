import type { Product } from "@/lib/types"
import { ProductCard } from "./product-card"

type ProductGridProps = {
  products: Product[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="theme-panel border-dashed p-8 text-sm opacity-70">
        No products are available yet. Add products in Medusa Admin and refresh
        the storefront.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
