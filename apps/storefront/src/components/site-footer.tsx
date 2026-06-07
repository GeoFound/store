import Link from "next/link"
import { getSiteConfig } from "@/lib/site-config"

export function SiteFooter() {
  const siteConfig = getSiteConfig()

  return (
    <footer className="theme-surface theme-border border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-semibold">
            <span className="theme-accent-action flex h-9 w-9 items-center justify-center text-sm">
              AD
            </span>
            <span>{siteConfig.site.name}</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 opacity-70">
            {siteConfig.site.description}. Digital goods, delivered from your
            order page with guest checkout and recoverable access.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Shop</h2>
          <div className="mt-4 grid gap-3 text-sm opacity-75">
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
            <span>Secure guest order access</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
