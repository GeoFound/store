export type AuditRetentionConfig = {
  enabled: boolean
  retentionDays: number
  minimumRetentionDays: number
  batchSize: number
}

const DEFAULT_RETENTION_DAYS = 365
const DEFAULT_MINIMUM_RETENTION_DAYS = 90
const DEFAULT_BATCH_SIZE = 1000

export function getAuditRetentionConfig(
  env: Record<string, string | undefined> = process.env
): AuditRetentionConfig {
  const minimumRetentionDays = readPositiveInteger(
    env.AUDIT_LOG_RETENTION_MIN_DAYS,
    DEFAULT_MINIMUM_RETENTION_DAYS
  )
  const retentionDays = readPositiveInteger(
    env.AUDIT_LOG_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS
  )

  if (retentionDays < minimumRetentionDays) {
    throw new Error(
      `AUDIT_LOG_RETENTION_DAYS must be at least ${minimumRetentionDays} days`
    )
  }

  return {
    enabled: readBoolean(env.AUDIT_LOG_RETENTION_ENABLED, true),
    retentionDays,
    minimumRetentionDays,
    batchSize: readPositiveInteger(
      env.AUDIT_LOG_RETENTION_PRUNE_BATCH_SIZE,
      DEFAULT_BATCH_SIZE
    ),
  }
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") {
    return fallback
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Audit retention numeric settings must be positive integers")
  }

  return parsed
}
