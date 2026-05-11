export type AnalyticsDispatchConfig = {
  enabled: boolean
  batchSize: number
  maxRetryAttempts: number
  retryBaseSeconds: number
  retryMaxSeconds: number
}

export function getAnalyticsDispatchConfig(
  env: Record<string, string | undefined> = process.env
): AnalyticsDispatchConfig {
  return {
    enabled: parseBoolean(env.ANALYTICS_ENABLED, true),
    batchSize: parseInteger(env.ANALYTICS_DISPATCH_BATCH_SIZE, 100, 1, 500),
    maxRetryAttempts: parseInteger(
      env.ANALYTICS_MAX_RETRY_ATTEMPTS,
      12,
      1,
      100
    ),
    retryBaseSeconds: parseInteger(
      env.ANALYTICS_RETRY_BASE_SECONDS,
      30,
      1,
      3600
    ),
    retryMaxSeconds: parseInteger(
      env.ANALYTICS_RETRY_MAX_SECONDS,
      3600,
      10,
      86400
    ),
  }
}

export function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!value || !value.trim()) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback
  }

  return parsed
}
