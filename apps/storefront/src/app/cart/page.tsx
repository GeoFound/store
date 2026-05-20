import { CartView } from "@/components/cart-view"
import { SiteHeader } from "@/components/site-header"

export default function CartPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Cart</h1>
          <p className="mt-2 text-sm opacity-70">
            Review your digital goods before guest checkout.
          </p>
        </div>
        <CartView />
      </main>
    </>
  )
}
