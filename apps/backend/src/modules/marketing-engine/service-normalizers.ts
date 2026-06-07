import { MedusaError } from "@medusajs/framework/utils"

export function normalizeCode(value: string, label: string) {
  const normalized = value.trim().toUpperCase()

  if (!normalized) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is required`)
  }

  if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(normalized)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${label} must be 2-64 chars of A-Z, 0-9, _, -`
    )
  }

  return normalized
}

export function normalizeCodeOptional(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return null
  }

  return normalizeCode(value, "code")
}

export function requireText(value: string | null | undefined, label: string) {
  const normalized = (value || "").trim()

  if (!normalized) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is required`)
  }

  return normalized
}

export function toNullableText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }

  return null
}

export function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function toDateOrNull(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid date value")
  }

  return date
}

export function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  return value as Record<string, unknown>
}

export function normalizeLimit(value: unknown, fallback: number) {
  const numeric = toNullableNumber(value)

  if (!numeric || numeric <= 0) {
    return fallback
  }

  return Math.min(Math.floor(numeric), 200)
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const email = value.trim().toLowerCase()

  return email || null
}
