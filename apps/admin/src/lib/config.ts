export const medusaBackendUrl = normalizeUrl(
  process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9002",
)

export const adminLocale = process.env.NEXT_PUBLIC_ADMIN_LOCALE || "zh-CN"

// Public URL of the built-in Medusa dashboard, used to deep-link to surfaces not
// yet migrated to this app (e.g. product pages) during the strangler migration.
export const medusaAdminUrl = normalizeUrl(
  process.env.NEXT_PUBLIC_MEDUSA_ADMIN_URL || "http://localhost:9000/app",
)

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}
