import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { listContentEntries } from "@/lib/content"
import { getSiteConfig } from "@/lib/site-config"

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
  const siteConfig = getSiteConfig()
  const insightsContent = siteConfig.content.insights
  const entries = await listContentEntries({ limit: 24 })

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <section className="theme-border border-b">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
            <div className="max-w-3xl">
              <p className="theme-accent-text text-sm font-semibold">
                {siteConfig.site.name}
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                {insightsContent.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 opacity-75">
                {insightsContent.description}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {entries.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/insights/${entry.slug}`}
                  className="theme-card group flex min-h-[260px] flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="theme-accent-surface px-3 py-1 text-xs font-semibold uppercase">
                      {formatContentType(entry.content_type)}
                    </span>
                    {entry.topic ? (
                      <span className="text-xs font-medium opacity-60">
                        {entry.topic}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-5 text-xl font-semibold leading-tight">
                    {entry.title}
                  </h2>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 opacity-75">
                    {entry.excerpt || entry.body}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm">
                    <span className="opacity-60">
                      {formatDate(entry.published_at || entry.created_at)}
                    </span>
                    <span className="theme-accent-text font-semibold transition-transform group-hover:translate-x-1">
                      {insightsContent.readMoreLabel}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="theme-panel max-w-2xl p-6">
              <h2 className="text-2xl font-semibold">
                {insightsContent.emptyTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 opacity-75">
                {insightsContent.emptyDescription}
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function formatContentType(value: string) {
  return value.replace(/_/g, " ")
}

function formatDate(value?: string | null) {
  if (!value) {
    return ""
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
