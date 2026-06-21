import type { Metadata } from "next"
import { PrivacyConsentBanner } from "@/components/privacy-consent-banner"
import { SiteFooter } from "@/components/site-footer"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { JsonLd } from "@/components/json-ld"
import { getSiteConfig } from "@/lib/site-config"
import { getSiteUrl, isIndexingEnabled } from "@/lib/seo"
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data"
import { getStorefrontThemeAttributes } from "@/theme/storefront-theme"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = getSiteConfig()
  const indexable = isIndexingEnabled()

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: siteConfig.site.name,
      template: `%s · ${siteConfig.site.name}`,
    },
    description: siteConfig.site.description,
    applicationName: siteConfig.site.name,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      siteName: siteConfig.site.name,
      locale: (siteConfig.site.locale || "en-US").replace("-", "_"),
      type: "website",
    },
    twitter: { card: "summary_large_image" },
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
  const indexable = isIndexingEnabled()

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
        {indexable ? (
          <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        ) : null}
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
