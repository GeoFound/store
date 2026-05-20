type Translate = (
  key: string,
  options?: Record<string, unknown>
) => string

export function translatedStatus(
  t: Translate,
  value?: string | null
) {
  const normalized = typeof value === "string" ? value.trim() : ""

  if (!normalized) {
    return "-"
  }

  return t(`status.${normalized}`, {
    defaultValue: normalized,
  })
}
