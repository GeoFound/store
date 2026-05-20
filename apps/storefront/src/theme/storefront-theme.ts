import type { CSSProperties } from "react"
import type { SiteThemeConfig } from "@/lib/site-config"

export type StorefrontThemeAttributes = {
  id: string
  variables: CSSProperties
  bodyClassName: string
}

export function getStorefrontThemeAttributes(
  theme: SiteThemeConfig
): StorefrontThemeAttributes {
  const themeId = normalizeThemeId(theme.id)
  const density = normalizeDensity(theme.density)

  return {
    id: themeId,
    bodyClassName: `theme-${themeId} theme-density-${density}`,
    variables: {
      "--site-background": theme.background,
      "--site-foreground": theme.foreground,
      "--site-accent": theme.accent,
      "--site-accent-secondary": theme.accentSecondary,
      "--site-surface": theme.surface,
      "--site-surface-muted": theme.surfaceMuted,
      "--site-border": theme.border,
      "--site-success": theme.success,
      "--site-danger": theme.danger,
      "--site-warning": theme.warning,
      "--site-radius": theme.radius,
    } as CSSProperties,
  }
}

function normalizeThemeId(value?: string) {
  const normalized = String(value || "base")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "base"
}

function normalizeDensity(value?: string) {
  return value === "compact" ? "compact" : "comfortable"
}
