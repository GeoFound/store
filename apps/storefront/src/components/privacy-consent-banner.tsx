"use client"

import { useState } from "react"
import {
  isPrivacyBannerEnabled,
  setAnalyticsConsent,
  useAnalyticsConsentDecision,
} from "@/lib/privacy-consent"

type PrivacyConsentBannerProps = {
  siteName: string
}

export function PrivacyConsentBanner(props: PrivacyConsentBannerProps) {
  const hasDecision = useAnalyticsConsentDecision()
  const [dismissed, setDismissed] = useState(false)

  if (!isPrivacyBannerEnabled() || hasDecision || dismissed) {
    return null
  }

  function handleDecision(analyticsEnabled: boolean) {
    setDismissed(true)
    setAnalyticsConsent(analyticsEnabled)
  }

  return (
    <aside className="theme-surface theme-overlay-surface theme-border fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm leading-6 opacity-75">
          {props.siteName} uses analytics cookies to measure checkout flow and
          improve product pages. You can allow or reject analytics tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="theme-secondary-action min-h-10 px-3 text-sm font-semibold"
            onClick={() => handleDecision(false)}
          >
            Reject
          </button>
          <button
            type="button"
            className="theme-primary-action min-h-10 px-3 text-sm font-semibold"
            onClick={() => handleDecision(true)}
          >
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  )
}
