import Link from "next/link"
import { getSiteConfig } from "@/lib/site-config"

export function SiteHeader() {
  const siteConfig = getSiteConfig()

  return (
    <header className="theme-surface theme-border border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-normal">
          {siteConfig.site.name}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/products" className="opacity-75 hover:opacity-100">
            {siteConfig.content.navigation.products}
          </Link>
          <Link href="/orders" className="opacity-75 hover:opacity-100">
            {siteConfig.content.navigation.orders}
          </Link>
          <Link
            href="/cart"
            className="theme-secondary-action px-3 py-2 font-medium"
          >
            {siteConfig.content.navigation.cart}
          </Link>
        </nav>
      </div>
    </header>
  )
}
