import { SiteHeader } from "@/components/site-header"
import { listContentEntries } from "@/lib/content"
import { getSiteConfig } from "@/lib/site-config"
import { InsightsSections } from "@/sections/insights"

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
  const siteConfig = getSiteConfig()
  const entries = await listContentEntries({ limit: 24 })

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <InsightsSections siteConfig={siteConfig} entries={entries} />
      </main>
    </>
  )
}
