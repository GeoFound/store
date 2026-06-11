import { CheckoutView } from "@/components/checkout-view"
import { SiteHeader } from "@/components/site-header"
import { getSiteConfig } from "@/lib/site-config"

export default function CheckoutPage() {
  const siteConfig = getSiteConfig()

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
              Buy without logging in, or use your signed-in account email for
              faster recovery and secure order access.
            </p>
          </div>
          <CheckoutView sections={siteConfig.experience.pages.checkout.sections} />
        </div>
      </main>
    </>
  )
}
