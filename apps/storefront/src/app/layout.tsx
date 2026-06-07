import type { Metadata } from "next"
import { PrivacyConsentBanner } from "@/components/privacy-consent-banner"
import { SiteFooter } from "@/components/site-footer"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { getSiteConfig } from "@/lib/site-config"
import { getStorefrontThemeAttributes } from "@/theme/storefront-theme"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = getSiteConfig()

  return {
    title: siteConfig.site.name,
    description: siteConfig.site.description,
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const siteConfig = getSiteConfig()
  const locale = siteConfig.site.locale || "en-US"
  const htmlLang = locale.split("-")[0] || locale
  ensureStorefrontExtensionsRegistered()
  const theme = getStorefrontThemeAttributes(siteConfig.theme)

  return (
    <html
      lang={htmlLang}
      className="h-full antialiased"
    >
      <body
        className={`${theme.bodyClassName} theme-page flex min-h-full flex-col`}
        style={theme.variables}
        data-site-id={siteConfig.site.id}
        data-theme-id={theme.id}
      >
        {children}
        <SiteFooter />
        <PrivacyConsentBanner siteName={siteConfig.site.name} />
        {renderStorefrontExtensions("layout.body.end", {}).map((entry) => (
          <div key={entry.key}>{entry.node}</div>
        ))}
      </body>
    </html>
  )
}
