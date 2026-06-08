import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { retrieveContentEntry } from "@/lib/content"
import { getSiteConfig } from "@/lib/site-config"

export const dynamic = "force-dynamic"

type InsightPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { slug } = await params
  const siteConfig = getSiteConfig()
  const entry = await retrieveContentEntry(slug)

  if (!entry) {
    notFound()
  }

  const insightsContent = siteConfig.content.insights
  const relatedHandles = entry.related_product_handles_json || []

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <article className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="theme-panel p-6 shadow-[var(--shadow-card)] sm:p-8">
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 text-sm font-semibold opacity-75 hover:opacity-100"
            >
              <span aria-hidden="true">&larr;</span>
              {insightsContent.backLabel}
            </Link>
            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="theme-accent-surface px-3 py-1 font-semibold uppercase">
                  {formatContentType(entry.content_type)}
                </span>
                {entry.topic ? <span className="opacity-60">{entry.topic}</span> : null}
                <span className="opacity-60">
                  {insightsContent.publishedLabel}{" "}
                  {formatDate(entry.published_at || entry.created_at)}
                </span>
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
                {entry.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 opacity-75">
                {entry.excerpt}
              </p>
            </div>

            <div className="theme-border mt-8 border-t pt-8">
              <div className="max-w-3xl space-y-5 text-base leading-8 opacity-85">
                {entry.body.split(/\n{2,}/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <div className="theme-panel p-5">
              <h2 className="text-lg font-semibold">
                {insightsContent.relatedProductsLabel}
              </h2>
              {relatedHandles.length ? (
                <div className="mt-4 grid gap-2">
                  {relatedHandles.map((handle) => (
                    <Link
                      key={handle}
                      href={`/products/${handle}`}
                      className="theme-secondary-action inline-flex min-h-10 items-center px-3 text-sm font-semibold"
                    >
                      {handle}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 opacity-70">
                  {siteConfig.content.catalog.description}
                </p>
              )}
            </div>
            {entry.tags_json?.length ? (
              <div className="theme-panel p-5">
                <h2 className="text-lg font-semibold">Topics</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.tags_json.map((tag) => (
                    <span
                      key={tag}
                      className="theme-accent-surface px-3 py-1 text-xs font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </article>
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
