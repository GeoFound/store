import { Suspense } from "react"
import { OrderLookupView } from "@/components/order-lookup-view"
import type {
  SiteConfig,
  SiteExperienceSectionConfig,
} from "@/lib/site-config"
import { renderConfiguredSections, sectionAttributes } from "./shared"

type OrdersSectionsProps = {
  siteConfig: SiteConfig
}

export function OrdersSections({ siteConfig }: OrdersSectionsProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      {renderConfiguredSections(
        siteConfig.experience.pages.orders.sections,
        (section) => {
          if (section.type === "order-recovery") {
            return <OrderRecoverySection section={section} />
          }

          if (section.type === "support-assurance") {
            return <SupportAssuranceSection section={section} />
          }

          return null
        }
      )}
    </div>
  )
}

function OrderRecoverySection({
  section,
}: {
  section: SiteExperienceSectionConfig
}) {
  return (
    <section {...sectionAttributes(section)}>
      <div className="mb-6">
        <h1 className="text-4xl font-semibold leading-tight">Find an order</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
          Open your order with an order access token, or recover access with
          your email and order ID. Legacy delivery tokens still work.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm opacity-70">Loading order tools...</p>}
      >
        <OrderLookupView />
      </Suspense>
    </section>
  )
}

function SupportAssuranceSection({
  section,
}: {
  section: SiteExperienceSectionConfig
}) {
  return (
    <section
      {...sectionAttributes(section)}
      className="theme-panel mt-8 grid gap-3 p-6"
    >
      <h2 className="text-lg font-semibold">Delivery support</h2>
      <p className="max-w-3xl text-sm leading-6 opacity-75">
        Keep your order access link after payment. If you lose it, order
        recovery can reopen the order by email and order ID without requiring a
        customer account.
      </p>
    </section>
  )
}
