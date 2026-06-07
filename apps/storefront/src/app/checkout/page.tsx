import { CheckoutView } from "@/components/checkout-view"
import { SiteHeader } from "@/components/site-header"

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-6">
            <h1 className="text-4xl font-semibold leading-tight">
              Guest checkout
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
              Buy without logging in. Your email is used for order recovery and
              secure order access.
            </p>
          </div>
          <CheckoutView />
        </div>
      </main>
    </>
  )
}
