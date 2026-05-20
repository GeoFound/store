"use client"

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

  if (!isPrivacyBannerEnabled() || hasDecision) {
    return null
  }

  return (
    <aside className="theme-surface theme-overlay-surface theme-border fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm leading-6 opacity-75">
          {props.siteName} uses analytics cookies to measure checkout flow and
          improve product pages. You can allow or reject analytics tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="theme-secondary-action px-3 py-2 text-sm font-semibold"
            onClick={() => setAnalyticsConsent(false)}
          >
            Reject
          </button>
          <button
            type="button"
            className="theme-primary-action px-3 py-2 text-sm font-semibold"
            onClick={() => setAnalyticsConsent(true)}
          >
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  )
}
