export const ADMIN_LANGUAGE_OPTIONS = [
  {
    code: "en",
    translationKey: "language.english",
  },
  {
    code: "zh-CN",
    translationKey: "language.chinese",
  },
] as const

export type AdminLanguage = (typeof ADMIN_LANGUAGE_OPTIONS)[number]["code"]

export function normalizeAdminLanguage(value?: string | null): AdminLanguage {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""

  if (normalized === "zh" || normalized === "zhcn" || normalized.startsWith("zh-")) {
    return "zh-CN"
  }

  return "en"
}

export function adminLanguageToRequestLocale(language: AdminLanguage) {
  return language === "zh-CN" ? "zh-CN" : "en"
}
