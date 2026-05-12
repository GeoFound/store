"use client"

import { useEffect, useState } from "react"

const CONSENT_STORAGE_KEY = "store:privacy-consent:v1"
const CONSENT_UPDATED_EVENT = "store:privacy-consent:updated"

type AnalyticsConsentRecord = {
  analytics: boolean
  updated_at: string
}

const ANALYTICS_COOKIE_PREFIXES = ["_ga", "_gid", "_gat", "_hj"]
const ANALYTICS_STORAGE_PREFIXES = ["_ga", "_gid", "_gat", "_hj", "_cl", "_fbp"]

export function isAnalyticsConsentRequired() {
  return parseBooleanFlag(
    process.env.NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT,
    true
  )
}

export function isPrivacyBannerEnabled() {
  if (!isAnalyticsConsentRequired()) {
    return false
  }

  return parseBooleanFlag(
    process.env.NEXT_PUBLIC_PRIVACY_BANNER_ENABLED,
    true
  )
}

export function readAnalyticsConsentRecord() {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as AnalyticsConsentRecord

    if (
      typeof parsed?.analytics === "boolean" &&
      typeof parsed?.updated_at === "string"
    ) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

export function hasAnalyticsConsent() {
  if (!isAnalyticsConsentRequired()) {
    return true
  }

  return readAnalyticsConsentRecord()?.analytics === true
}

export function hasAnalyticsConsentDecision() {
  if (!isAnalyticsConsentRequired()) {
    return true
  }

  return Boolean(readAnalyticsConsentRecord())
}

export function setAnalyticsConsent(analyticsEnabled: boolean) {
  if (typeof window === "undefined") {
    return
  }

  const record: AnalyticsConsentRecord = {
    analytics: analyticsEnabled,
    updated_at: new Date().toISOString(),
  }

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))

  if (!analyticsEnabled) {
    clearAnalyticsStorageArtifacts()
  }

  window.dispatchEvent(
    new CustomEvent<AnalyticsConsentRecord>(CONSENT_UPDATED_EVENT, {
      detail: record,
    })
  )
}

export function useAnalyticsConsent() {
  const [allowed, setAllowed] = useState<boolean>(() => hasAnalyticsConsent())

  useEffect(() => {
    const sync = () => {
      setAllowed(hasAnalyticsConsent())
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CONSENT_STORAGE_KEY) {
        return
      }

      sync()
    }

    sync()
    window.addEventListener(CONSENT_UPDATED_EVENT, sync)
    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, sync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  return allowed
}

export function useAnalyticsConsentDecision() {
  const [hasDecision, setHasDecision] = useState<boolean>(() =>
    hasAnalyticsConsentDecision()
  )

  useEffect(() => {
    const sync = () => {
      setHasDecision(hasAnalyticsConsentDecision())
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CONSENT_STORAGE_KEY) {
        return
      }

      sync()
    }

    sync()
    window.addEventListener(CONSENT_UPDATED_EVENT, sync)
    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener(CONSENT_UPDATED_EVENT, sync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  return hasDecision
}

function clearAnalyticsStorageArtifacts() {
  try {
    const cookies = document.cookie.split(";")

    for (const cookie of cookies) {
      const [rawName] = cookie.trim().split("=")
      const name = rawName || ""

      if (!ANALYTICS_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
        continue
      }

      document.cookie = `${name}=; Max-Age=0; path=/`
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`
    }
  } catch {
    // Best-effort cookie cleanup only.
  }

  try {
    const keysToDelete: string[] = []

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)

      if (!key) {
        continue
      }

      if (ANALYTICS_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Best-effort storage cleanup only.
  }
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}
