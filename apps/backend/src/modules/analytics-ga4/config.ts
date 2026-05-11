import { parseBoolean } from "../analytics-core/config"

export function isGa4BackendEnabled(
  env: Record<string, string | undefined> = process.env
) {
  const enabled = parseBoolean(env.GA4_ENABLED, true)

  if (!enabled) {
    return false
  }

  return Boolean(env.GA4_MEASUREMENT_ID?.trim() && env.GA4_API_SECRET?.trim())
}

export function getGa4BackendConfig(
  env: Record<string, string | undefined> = process.env
) {
  return {
    measurementId: env.GA4_MEASUREMENT_ID?.trim() || "",
    apiSecret: env.GA4_API_SECRET?.trim() || "",
    enabled: isGa4BackendEnabled(env),
  }
}
