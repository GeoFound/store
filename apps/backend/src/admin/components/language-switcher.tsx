import { Button, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ADMIN_LANGUAGE_OPTIONS,
  type AdminLanguage,
  adminLanguageToRequestLocale,
  normalizeAdminLanguage,
} from "../lib/admin-locale"

export function AdminLanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [language, setLanguage] = useState<AdminLanguage>(
    normalizeAdminLanguage(i18n.resolvedLanguage || i18n.language)
  )

  useEffect(() => {
    function handleLanguageChange(nextLanguage: string) {
      const normalized = normalizeAdminLanguage(nextLanguage)
      setLanguage(normalized)

      if (typeof document !== "undefined") {
        document.documentElement.lang = adminLanguageToRequestLocale(normalized)
      }

      if (typeof window !== "undefined") {
        persistAdminLanguage(normalized)
      }
    }

    handleLanguageChange(i18n.resolvedLanguage || i18n.language)
    i18n.on("languageChanged", handleLanguageChange)

    return () => {
      i18n.off("languageChanged", handleLanguageChange)
    }
  }, [i18n])

  async function selectLanguage(nextLanguage: AdminLanguage) {
    setLanguage(nextLanguage)

    if (typeof document !== "undefined") {
      document.documentElement.lang = adminLanguageToRequestLocale(nextLanguage)
    }

    if (typeof window !== "undefined") {
      persistAdminLanguage(nextLanguage)
    }

    await i18n.changeLanguage(nextLanguage)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Text className="text-ui-fg-subtle">{t("language.label")}</Text>
      <div
        className="inline-flex w-fit overflow-hidden rounded-md border border-ui-border-base"
        role="group"
        aria-label={t("language.label")}
      >
        {ADMIN_LANGUAGE_OPTIONS.map((option) => {
          const selected = option.code === language

          return (
            <Button
              key={option.code}
              type="button"
              variant={selected ? "primary" : "secondary"}
              className="rounded-none border-0"
              onClick={() => selectLanguage(option.code)}
            >
              {t(option.translationKey)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function persistAdminLanguage(language: AdminLanguage) {
  window.localStorage.setItem("lng", language)
  window.localStorage.setItem("i18nextLng", language)
  document.cookie = `lng=${language}; path=/; max-age=31536000; SameSite=Lax`
}
