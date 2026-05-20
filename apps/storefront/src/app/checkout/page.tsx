import { CheckoutView } from "@/components/checkout-view"
import { SiteHeader } from "@/components/site-header"

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">
            Guest checkout
          </h1>
          <p className="mt-2 text-sm opacity-70">
            Buy without logging in. Your email is used for order recovery and
            secure order access.
          </p>
        </div>
        <CheckoutView />
      </main>
    </>
  )
}
