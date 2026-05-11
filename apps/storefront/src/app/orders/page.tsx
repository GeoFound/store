import { Suspense } from "react"
import { SiteHeader } from "@/components/site-header"
import { OrderLookupView } from "@/components/order-lookup-view"

export default function OrdersPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-stone-950">
            Find an order
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Open your order with an order access token, or recover access with
            your email and order ID. Legacy delivery tokens still work.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-stone-600">Loading order tools...</p>}>
          <OrderLookupView />
        </Suspense>
      </main>
    </>
  )
}
