import { SiteHeader } from "@/components/site-header"
import { getSiteConfig } from "@/lib/site-config"
import { OrdersSections } from "@/sections/orders"

export default function OrdersPage() {
  const siteConfig = getSiteConfig()

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <OrdersSections siteConfig={siteConfig} />
      </main>
    </>
  )
}
