export const medusaBackendUrl = normalizeUrl(
  process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9002",
)

export const adminLocale = process.env.NEXT_PUBLIC_ADMIN_LOCALE || "zh-CN"

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}
