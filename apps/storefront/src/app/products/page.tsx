import { ProductGrid } from "@/components/product-grid"
import { SiteHeader } from "@/components/site-header"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { listProducts } from "@/lib/medusa"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  ensureStorefrontExtensionsRegistered()
  const products = await safeListProducts()

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-stone-950">Products</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Guest checkout is supported. Add a product, enter an email, and pay
            without creating an account.
          </p>
        </div>
        <div className="mb-6 grid gap-4">
          {renderStorefrontExtensions("products.header.after", {}).map((entry) => (
            <div key={entry.key}>{entry.node}</div>
          ))}
        </div>
        <ProductGrid products={products} />
      </main>
    </>
  )
}

async function safeListProducts() {
  try {
    return await listProducts()
  } catch {
    return []
  }
}
