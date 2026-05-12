import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { PrivacyConsentBanner } from "@/components/privacy-consent-banner"
import { ensureStorefrontExtensionsRegistered } from "@/extensions/defaults"
import { renderStorefrontExtensions } from "@/extensions/registry"
import { getSiteConfig } from "@/lib/site-config"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

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

  const themeVariables = {
    "--site-background": siteConfig.theme.background,
    "--site-foreground": siteConfig.theme.foreground,
    "--site-accent": siteConfig.theme.accent,
    "--site-accent-secondary": siteConfig.theme.accentSecondary,
    "--site-surface": siteConfig.theme.surface,
    "--site-surface-muted": siteConfig.theme.surfaceMuted,
  } as CSSProperties

  return (
    <html
      lang={htmlLang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        style={themeVariables}
        data-site-id={siteConfig.site.id}
      >
        {children}
        <PrivacyConsentBanner siteName={siteConfig.site.name} />
        {renderStorefrontExtensions("layout.body.end", {}).map((entry) => (
          <div key={entry.key}>{entry.node}</div>
        ))}
      </body>
    </html>
  )
}
