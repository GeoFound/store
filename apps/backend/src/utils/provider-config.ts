/**
 * Shared parsing/sanitization helpers for env-driven provider configuration.
 *
 * Both the AI runtime (`modules/ai-core/config.ts`) and the content storage
 * runtime (`modules/content-core/storage.ts`) read provider definitions from a
 * JSON env var, reference secrets by environment-variable name only, and redact
 * secret-like values before exposing config to the admin surface. This module
 * is the single source of truth for that cross-cutting logic so the two
 * runtimes cannot drift apart (which previously caused divergent secret
 * redaction patterns).
 */

/**
 * Matches any object key that looks like it could carry a secret. The union is
 * intentionally broad: a bare `key`, `api_key`, `access_key`, tokens,
 * passwords, and credentials are all redacted from exposed metadata.
 */
export const SECRET_FIELD_PATTERN =
  /secret|token|password|credential|api[_-]?key|access[_-]?key|key/i

/** Matches a valid environment-variable name (the only allowed secret source). */
export const ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/

/** Matches a normalized provider code. */
export const PROVIDER_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/

export function text(value: string | undefined): string {
  return value?.trim() || ""
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
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

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  const value = source[key]

  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    return parseBoolean(value, fallback)
  }

  return fallback
}

export function readBooleanFromKeys(
  source: Record<string, unknown>,
  keys: string[],
  fallback: boolean
): boolean {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return readBoolean(source, key, fallback)
    }
  }

  return fallback
}

export function readNumber(
  source: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = source[key]
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  return Number.isFinite(parsed) ? parsed : fallback
}

export function readText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

export function readStringArray(
  source: Record<string, unknown>,
  keys: string[]
): string[] {
  for (const key of keys) {
    const value = source[key]

    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }

  return []
}

export function readRecord(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = source[key]
  return isRecord(value) ? value : null
}

export function normalizeCode(
  value: string,
  issues: string[],
  options?: { fallback?: string; label?: string }
): string {
  const label = options?.label || "Provider"
  const fallback = options?.fallback || "provider"
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-")

  if (!PROVIDER_CODE_PATTERN.test(normalized)) {
    issues.push(
      `${label} code must use lowercase letters, numbers, underscore, or hyphen`
    )
  }

  return normalized || fallback
}

export function normalizeBaseUrl(value: string): string | null {
  const normalized = value.trim()
  return normalized ? normalized.replace(/\/+$/, "") : null
}

/** Deeply redacts secret-like keys from an arbitrary config record. */
export function sanitizeRecord(
  source: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      SECRET_FIELD_PATTERN.test(key) ? "[redacted]" : sanitizeValue(value),
    ])
  )
}

export function sanitizeMetadata(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  return value ? sanitizeRecord(value) : null
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry))
  }

  if (isRecord(value)) {
    return sanitizeRecord(value)
  }

  return value
}

/**
 * Returns true when the source object carries an inline secret-like field that
 * is NOT an allow-listed env-name reference. Inline secrets are rejected so
 * that only environment-variable references can supply credentials.
 */
export function hasInlineSecret(
  source: Record<string, unknown>,
  allowKeys: string[]
): boolean {
  const allowed = new Set(allowKeys)

  return Object.keys(source).some((key) => {
    if (allowed.has(key)) {
      return false
    }

    return SECRET_FIELD_PATTERN.test(key)
  })
}
