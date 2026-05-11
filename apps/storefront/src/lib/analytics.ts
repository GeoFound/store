"use client"

export type StoreAnalyticsEventDetail = {
  name: string
  params: Record<string, unknown>
  occurred_at: string
}

export type StoreAnalyticsEmitOptions = {
  dedupeKey?: string
}

const ANALYTICS_DEDUPE_PREFIX = "store:analytics:event:"

export function emitStoreAnalyticsEvent(
  name: string,
  params: Record<string, unknown> = {},
  options: StoreAnalyticsEmitOptions = {}
) {
  if (typeof window === "undefined") {
    return false
  }

  const dedupeKey = normalizeText(options.dedupeKey)

  if (dedupeKey) {
    const storageKey = `${ANALYTICS_DEDUPE_PREFIX}${dedupeKey}`

    if (window.sessionStorage.getItem(storageKey)) {
      return false
    }

    window.sessionStorage.setItem(storageKey, new Date().toISOString())
  }

  const detail: StoreAnalyticsEventDetail = {
    name,
    params,
    occurred_at: new Date().toISOString(),
  }

  window.dispatchEvent(new CustomEvent<StoreAnalyticsEventDetail>("store:analytics", {
    detail,
  }))

  return true
}

export function getCheckoutAnalyticsContext() {
  if (typeof window === "undefined") {
    return {}
  }

  return {
    ga_client_id: readGaClientId(),
    ga_session_id: readGaSessionId(),
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || undefined,
  }
}

export function minorToDecimal(amountMinor: number, currency: string) {
  const safeMinor = Number.isFinite(amountMinor) ? amountMinor : 0
  const normalizedCurrency = currency.trim().toUpperCase()

  if (
    [
      "BIF",
      "CLP",
      "DJF",
      "GNF",
      "JPY",
      "KMF",
      "KRW",
      "MGA",
      "PYG",
      "RWF",
      "UGX",
      "VND",
      "VUV",
      "XAF",
      "XOF",
      "XPF",
    ].includes(normalizedCurrency)
  ) {
    return safeMinor
  }

  return Number((safeMinor / 100).toFixed(2))
}

export function buildCheckoutItems(
  items: Array<{
    variant_id?: string
    title?: string
    quantity?: number
    unit_price?: number
  }> = []
) {
  return items.map((item) => ({
    item_id: item.variant_id || "unknown_variant",
    item_name: item.title || "Digital product",
    quantity: item.quantity || 1,
    price: minorToDecimal(item.unit_price || 0, "USD"),
  }))
}

function readGaClientId() {
  const gaCookie = readCookie("_ga")

  if (!gaCookie) {
    return undefined
  }

  const parts = gaCookie.split(".")

  if (parts.length < 4) {
    return undefined
  }

  return `${parts[2]}.${parts[3]}`
}

function readGaSessionId() {
  const sessionCookie =
    findCookieByPrefix("_ga_") || findCookieByPrefix("_gid_")

  if (!sessionCookie) {
    return undefined
  }

  const parts = sessionCookie.split(".")

  if (parts.length < 4) {
    return undefined
  }

  return parts[2]
}

function findCookieByPrefix(prefix: string) {
  const cookies = document.cookie.split(";")

  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split("=")

    if (rawName.startsWith(prefix)) {
      return decodeURIComponent(rest.join("="))
    }
  }

  return undefined
}

function readCookie(name: string) {
  const cookies = document.cookie.split(";")

  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split("=")

    if (rawName === name) {
      return decodeURIComponent(rest.join("="))
    }
  }

  return undefined
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
