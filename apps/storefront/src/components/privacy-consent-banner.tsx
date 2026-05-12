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
    <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm leading-6 text-stone-700">
          {props.siteName} uses analytics cookies to measure checkout flow and
          improve product pages. You can allow or reject analytics tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 hover:border-stone-900"
            onClick={() => setAnalyticsConsent(false)}
          >
            Reject
          </button>
          <button
            type="button"
            className="bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700"
            onClick={() => setAnalyticsConsent(true)}
          >
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  )
}
