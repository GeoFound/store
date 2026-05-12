"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import type { StoreAnalyticsEventDetail } from "@/lib/analytics"
import { useAnalyticsConsent } from "@/lib/privacy-consent"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || ""

export function Ga4StorefrontScript() {
  const pathname = usePathname()
  const hasAnalyticsConsent = useAnalyticsConsent()

  useEffect(() => {
    if (
      !measurementId ||
      !hasAnalyticsConsent ||
      typeof window === "undefined" ||
      !window.gtag
    ) {
      return
    }

    const pagePath = `${pathname || "/"}${window.location.search || ""}`

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
    })
  }, [pathname, hasAnalyticsConsent])

  useEffect(() => {
    if (!measurementId || !hasAnalyticsConsent || typeof window === "undefined") {
      return
    }

    const handler = (event: Event) => {
      if (!window.gtag) {
        return
      }

      const detail = (event as CustomEvent<StoreAnalyticsEventDetail>).detail

      if (!detail?.name) {
        return
      }

      window.gtag("event", detail.name, detail.params || {})
    }

    window.addEventListener("store:analytics", handler)

    return () => {
      window.removeEventListener("store:analytics", handler)
    }
  }, [hasAnalyticsConsent])

  if (!measurementId || !hasAnalyticsConsent) {
    return null
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-inline-bootstrap" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);} 
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
    </>
  )
}
