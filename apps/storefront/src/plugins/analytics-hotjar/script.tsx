"use client"

import Script from "next/script"
import { useEffect } from "react"
import type { StoreAnalyticsEventDetail } from "@/lib/analytics"

declare global {
  interface Window {
    hj?: (...args: unknown[]) => void
    _hjSettings?: {
      hjid: number
      hjsv: number
    }
  }
}

const siteId = process.env.NEXT_PUBLIC_HOTJAR_SITE_ID || ""
const snippetVersion = process.env.NEXT_PUBLIC_HOTJAR_SNIPPET_VERSION || "6"

export function HotjarStorefrontScript() {
  useEffect(() => {
    if (!siteId || typeof window === "undefined") {
      return
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StoreAnalyticsEventDetail>).detail

      if (!detail?.name || !window.hj) {
        return
      }

      window.hj("event", sanitizeHotjarEvent(detail.name))
    }

    window.addEventListener("store:analytics", handler)

    return () => {
      window.removeEventListener("store:analytics", handler)
    }
  }, [])

  if (!siteId) {
    return null
  }

  return (
    <Script id="hotjar-inline-bootstrap" strategy="afterInteractive">
      {`
        (function(h,o,t,j,a,r){
          h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          h._hjSettings={hjid:${Number(siteId)},hjsv:${Number(snippetVersion)}};
          a=o.getElementsByTagName('head')[0];
          r=o.createElement('script');r.async=1;
          r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
      `}
    </Script>
  )
}

function sanitizeHotjarEvent(value: string) {
  return `store_${value}`.toLowerCase().replace(/[^a-z0-9_]/g, "_")
}
