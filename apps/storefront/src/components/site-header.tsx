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
      <div className="mx-auto flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 overflow-hidden px-4 py-2 sm:h-[68px] sm:flex-nowrap sm:px-6 sm:py-0">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-3 text-base font-semibold tracking-normal"
          aria-label={`${siteConfig.site.name} home`}
        >
          <span className="theme-accent-action flex h-9 w-9 items-center justify-center text-sm">
            {initials || "AI"}
          </span>
          <span>{siteConfig.site.name}</span>
        </Link>
        <nav className="order-2 w-full min-w-0 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-1 [&::-webkit-scrollbar]:hidden">
          <div className="flex w-full items-center justify-between gap-1 whitespace-nowrap text-xs sm:ml-auto sm:w-max sm:justify-start sm:gap-5 sm:text-sm">
            <Link
              href="/insights"
              className="px-1.5 py-2 opacity-75 hover:opacity-100 sm:px-2"
            >
              {siteConfig.content.navigation.insights}
            </Link>
            <Link
              href="/products"
              className="px-1.5 py-2 opacity-75 hover:opacity-100 sm:px-2"
            >
              <span className="sm:hidden">Products</span>
              <span className="hidden sm:inline">
                {siteConfig.content.navigation.products}
              </span>
            </Link>
            <Link
              href="/orders"
              className="px-1.5 py-2 opacity-75 hover:opacity-100 sm:px-2"
            >
              {siteConfig.content.navigation.orders}
            </Link>
            <Link
              href="/account"
              className="px-1.5 py-2 opacity-75 hover:opacity-100 sm:px-2"
            >
              Account
            </Link>
            <Link
              href="/cart"
              className="theme-secondary-action inline-flex items-center gap-1.5 px-2 py-2 font-semibold sm:gap-2 sm:px-3"
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
          </div>
        </nav>
      </div>
    </header>
  )
}
