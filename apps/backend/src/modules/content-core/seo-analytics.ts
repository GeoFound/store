import crypto from "node:crypto"

/**
 * Google Search Console (GSC) ingestion — the SEO performance feedback source
 * (Phase 3). Server-to-server auth uses a Google service account (JWT bearer
 * grant). Everything is config-driven, fetcher-injectable, and degrades
 * gracefully when unconfigured, so it is unit-testable and CI-safe without live
 * credentials. See docs/seo-aeo-geo-architecture.md.
 *
 * Config (fixed env vars, referenced — never logged):
 *   SEO_GSC_ENABLED          - master toggle
 *   SEO_GSC_SITE_URL         - GSC property (e.g. "sc-domain:example.com")
 *   SEO_GSC_SERVICE_ACCOUNT  - service account JSON (secret)
 */

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token"

export type SeoAnalyticsStatus =
  | "disabled"
  | "missing_config"
  | "missing_secret"
  | "invalid"
  | "configured"

export type SeoAnalyticsConfig = {
  enabled: boolean
  site_url: string | null
  service_account_configured: boolean
  status: SeoAnalyticsStatus
  issues: string[]
}

export type SeoAnalyticsRow = {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type SeoAnalyticsResult = {
  configured: boolean
  status: SeoAnalyticsStatus
  site_url: string | null
  start_date: string
  end_date: string
  dimension: string
  rows: SeoAnalyticsRow[]
}

type Fetcher = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  json(): Promise<unknown>
  text(): Promise<string>
}>

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri: string
}

export function getSeoAnalyticsConfig(
  env: Record<string, string | undefined> = process.env
): SeoAnalyticsConfig {
  const enabled = parseBoolean(env.SEO_GSC_ENABLED, false)
  const siteUrl = text(env.SEO_GSC_SITE_URL) || null
  const rawServiceAccount = text(env.SEO_GSC_SERVICE_ACCOUNT)
  const serviceAccountConfigured = Boolean(rawServiceAccount)
  const issues: string[] = []

  let status: SeoAnalyticsStatus = "configured"
  if (!enabled) {
    status = "disabled"
  } else if (!siteUrl) {
    status = "missing_config"
  } else if (!serviceAccountConfigured) {
    status = "missing_secret"
  } else if (!parseServiceAccount(rawServiceAccount)) {
    status = "invalid"
    issues.push("SEO_GSC_SERVICE_ACCOUNT is not a valid service account JSON")
  }

  return {
    enabled,
    site_url: siteUrl,
    service_account_configured: serviceAccountConfigured,
    status,
    issues,
  }
}

export async function querySearchAnalytics(input: {
  env?: Record<string, string | undefined>
  fetcher?: Fetcher
  now?: number
  startDate: string
  endDate: string
  dimension?: "page" | "query" | "date"
  rowLimit?: number
}): Promise<SeoAnalyticsResult> {
  const env = input.env || process.env
  const config = getSeoAnalyticsConfig(env)
  const dimension = input.dimension || "page"
  const base: Omit<SeoAnalyticsResult, "rows"> = {
    configured: config.status === "configured",
    status: config.status,
    site_url: config.site_url,
    start_date: input.startDate,
    end_date: input.endDate,
    dimension,
  }

  if (config.status !== "configured") {
    return { ...base, rows: [] }
  }

  const serviceAccount = parseServiceAccount(text(env.SEO_GSC_SERVICE_ACCOUNT))
  if (!serviceAccount) {
    return { ...base, configured: false, status: "invalid", rows: [] }
  }

  const fetcher = input.fetcher || (globalThis.fetch as unknown as Fetcher)
  const token = await getGoogleAccessToken({
    serviceAccount,
    fetcher,
    now: input.now,
  })

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    config.site_url as string
  )}/searchAnalytics/query`
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: [dimension],
      rowLimit: clampRowLimit(input.rowLimit),
    }),
  })

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500)
    throw new Error(
      `Google Search Console query failed with ${response.status}: ${body || response.statusText}`
    )
  }

  const data = toRecord(await response.json())
  const rawRows = Array.isArray(data?.rows) ? data?.rows : []

  return {
    ...base,
    rows: rawRows.map(normalizeRow),
  }
}

export async function getGoogleAccessToken(input: {
  serviceAccount: ServiceAccount
  fetcher: Fetcher
  now?: number
}): Promise<string> {
  const assertion = buildSignedJwt(input.serviceAccount, input.now)
  const response = await input.fetcher(input.serviceAccount.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  })

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500)
    throw new Error(
      `Google token exchange failed with ${response.status}: ${body || response.statusText}`
    )
  }

  const data = toRecord(await response.json())
  const token = typeof data?.access_token === "string" ? data.access_token : ""
  if (!token) {
    throw new Error("Google token exchange did not return an access token")
  }
  return token
}

function buildSignedJwt(serviceAccount: ServiceAccount, now?: number): string {
  const issuedAt = Math.floor((now ?? Date.now()) / 1000)
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: GSC_SCOPE,
      aud: serviceAccount.token_uri,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  )
  const signingInput = `${header}.${claim}`
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .sign(serviceAccount.private_key, "base64url")

  return `${signingInput}.${signature}`
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clientEmail = text(parsed.client_email as string | undefined)
    const privateKey = text(parsed.private_key as string | undefined)
    if (!clientEmail || !privateKey) {
      return null
    }
    return {
      client_email: clientEmail,
      private_key: privateKey,
      token_uri: text(parsed.token_uri as string | undefined) || DEFAULT_TOKEN_URI,
    }
  } catch {
    return null
  }
}

function normalizeRow(row: unknown): SeoAnalyticsRow {
  const record = toRecord(row)
  const keys = Array.isArray(record?.keys) ? record?.keys : []
  return {
    key: typeof keys[0] === "string" ? keys[0] : "",
    clicks: toNumber(record?.clicks),
    impressions: toNumber(record?.impressions),
    ctr: toNumber(record?.ctr),
    position: toNumber(record?.position),
  }
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url")
}

function clampRowLimit(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 100
  }
  return Math.min(Math.floor(parsed), 5000)
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function text(value: string | undefined): string {
  return value?.trim() || ""
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
