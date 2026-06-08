import Link from "next/link"
import { getSiteConfig } from "@/lib/site-config"

export function SiteHeader() {
  const siteConfig = getSiteConfig()
  const initials = siteConfig.site.name
    .split(/\s+/)
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="theme-overlay-surface theme-border sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-base font-semibold tracking-normal"
          aria-label={`${siteConfig.site.name} home`}
        >
          <span className="theme-accent-action flex h-9 w-9 items-center justify-center text-sm">
            {initials || "AI"}
          </span>
          <span>{siteConfig.site.name}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-5">
          <Link href="/insights" className="px-2 py-2 opacity-75 hover:opacity-100">
            {siteConfig.content.navigation.insights}
          </Link>
          <Link href="/products" className="px-2 py-2 opacity-75 hover:opacity-100">
            {siteConfig.content.navigation.products}
          </Link>
          <Link href="/orders" className="px-2 py-2 opacity-75 hover:opacity-100">
            {siteConfig.content.navigation.orders}
          </Link>
          <Link
            href="/cart"
            className="theme-secondary-action inline-flex items-center gap-2 px-3 py-2 font-semibold"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M7.2 8h13.1l-1.5 8.1a2 2 0 0 1-2 1.7H9.4a2 2 0 0 1-2-1.6L5.7 4.8H3.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 21a.8.8 0 1 0 0-1.6A.8.8 0 0 0 10 21ZM17.2 21a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {siteConfig.content.navigation.cart}
          </Link>
        </nav>
      </div>
    </header>
  )
}
