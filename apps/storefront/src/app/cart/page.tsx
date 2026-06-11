import { CartView } from "@/components/cart-view"
import { SiteHeader } from "@/components/site-header"
import { getSiteConfig } from "@/lib/site-config"

export default function CartPage() {
  const siteConfig = getSiteConfig()

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-6">
            <h1 className="text-4xl font-semibold leading-tight">Cart</h1>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Review your digital goods before guest checkout.
            </p>
          </div>
          <CartView sections={siteConfig.experience.pages.cart.sections} />
        </div>
      </main>
    </>
  )
}
