import Link from "next/link"
import { getSiteConfig } from "@/lib/site-config"

export function SiteFooter() {
  const siteConfig = getSiteConfig()
  const initials = siteConfig.site.name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <footer className="theme-surface theme-border border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-semibold">
            <span className="theme-accent-action flex h-9 w-9 items-center justify-center text-sm">
              {initials || "AI"}
            </span>
            <span>{siteConfig.site.name}</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 opacity-70">
            {siteConfig.site.description}. Articles, AI resources, and digital
            products connected through one publishing and commerce platform.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Explore</h2>
          <div className="mt-4 grid gap-3 text-sm opacity-75">
            <Link href="/insights" className="hover:opacity-100">
              {siteConfig.content.navigation.insights}
            </Link>
            <Link href="/products" className="hover:opacity-100">
              {siteConfig.content.navigation.products}
            </Link>
            <Link href="/cart" className="hover:opacity-100">
              {siteConfig.content.navigation.cart}
            </Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Support</h2>
          <div className="mt-4 grid gap-3 text-sm opacity-75">
            <Link href="/orders" className="hover:opacity-100">
              {siteConfig.content.navigation.orders}
            </Link>
            <span>Recoverable guest order access</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
