import fs from "node:fs"
import path from "node:path"
import { cache } from "react"

export type SiteThemeConfig = {
  background: string
  foreground: string
  accent: string
  accentSecondary: string
  surface: string
  surfaceMuted: string
}

export type SiteContentConfig = {
  navigation: {
    products: string
    orders: string
    cart: string
  }
  home: {
    headline: string
    description: string
    browseCta: string
    ordersCta: string
    productsHeading: string
    productsDescription: string
    heroPattern: string
  }
}

export type SiteConfig = {
  site: {
    id: string
    name: string
    description: string
    locale: string
    currency: string
    timezone: string
  }
  domains: {
    storefront: string
    api: string
  }
  theme: SiteThemeConfig
  content: SiteContentConfig
  platform: {
    enabledPlugins: string[]
    disabledPlugins: string[]
    enabledContracts: Record<string, string[]>
    disabledContracts: Record<string, string[]>
  }
}

type SiteConfigInput = Partial<SiteConfig> & {
  theme?: Partial<SiteThemeConfig> & {
    accent_secondary?: string
    surface_muted?: string
  }
  content?: Partial<SiteContentConfig> & {
    navigation?: Partial<SiteContentConfig["navigation"]>
    home?: Partial<SiteContentConfig["home"]> & {
      browse_cta?: string
      orders_cta?: string
      products_heading?: string
      products_description?: string
      hero_pattern?: string
    }
  }
  platform?: {
    enabled_plugins?: unknown
    disabled_plugins?: unknown
    enabled_contracts?: unknown
    disabled_contracts?: unknown
  }
}

const BASE_SITE_CONFIG: SiteConfig = {
  site: {
    id: "",
    name: "Atlas Digital",
    description: "Independent digital goods store",
    locale: "en-US",
    currency: "usd",
    timezone: "UTC",
  },
  domains: {
    storefront: "example.com",
    api: "api.example.com",
  },
  theme: {
    background: "#f7f5f0",
    foreground: "#1c1917",
    accent: "#0f766e",
    accentSecondary: "#f97316",
    surface: "#ffffff",
    surfaceMuted: "#f5f5f4",
  },
  content: {
    navigation: {
      products: "Products",
      orders: "Orders",
      cart: "Cart",
    },
    home: {
      headline: "Digital goods, delivered from your order page.",
      description:
        "Browse, checkout as a guest, pay, and use your order access link to view delivery details. No account is required to buy.",
      browseCta: "Browse products",
      ordersCta: "Find an order",
      productsHeading: "Available products",
      productsDescription: "Managed by Medusa, sold through this storefront.",
      heroPattern:
        "linear-gradient(135deg,#0f766e 0%,#0f766e 45%,#f97316 45%,#f97316 68%,#1c1917 68%)",
    },
  },
  platform: {
    enabledPlugins: [],
    disabledPlugins: [],
    enabledContracts: {},
    disabledContracts: {},
  },
}

export const getSiteConfig = cache(() => {
  const siteId = resolveSiteId()
  const siteEnv = resolveSiteEnv()
  const fallbackConfig: SiteConfig = {
    ...BASE_SITE_CONFIG,
    site: {
      ...BASE_SITE_CONFIG.site,
      id: siteId,
    },
  }

  const candidates: Array<[string, string]> = [[siteId, siteEnv]]
  if (siteEnv !== "production") {
    candidates.push([siteId, "production"])
  }

  const parseErrors: string[] = []

  for (const [candidateSiteId, candidateSiteEnv] of candidates) {
    const filePath = resolveSiteProfilePath(candidateSiteId, candidateSiteEnv)

    if (!fs.existsSync(filePath)) {
      continue
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8")
      const parsed = JSON.parse(raw) as SiteConfigInput
      return normalizeSiteConfig(parsed, fallbackConfig)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parsing error"
      parseErrors.push(`${filePath}: ${message}`)
    }
  }

  const expectedPaths = candidates
    .map(([candidateSiteId, candidateSiteEnv]) =>
      resolveSiteProfilePath(candidateSiteId, candidateSiteEnv)
    )
    .join("\n- ")

  if (parseErrors.length) {
    throw new Error(
      [
        `Failed to parse site profile for SITE_ID=${siteId} SITE_ENV=${siteEnv}.`,
        ...parseErrors.map((entry) => `- ${entry}`),
      ].join("\n")
    )
  }

  throw new Error(
    `Site profile not found for SITE_ID=${siteId} SITE_ENV=${siteEnv}. Expected one of:\n- ${expectedPaths}`
  )
})

function resolveSiteProfilePath(siteId: string, siteEnv: string) {
  const root = path.join(process.cwd(), "profiles", "sites")
  return path.join(root, siteId, siteEnv, "site.json")
}

function resolveSiteId() {
  const siteId =
    toOptionalString(process.env.NEXT_PUBLIC_SITE_ID) ||
    toOptionalString(process.env.SITE_ID)

  if (siteId) {
    return siteId
  }

  throw new Error(
    "SITE_ID is required. Set NEXT_PUBLIC_SITE_ID or SITE_ID and provide profiles/sites/<site-id>/<site-env>/site.json."
  )
}

function resolveSiteEnv() {
  return toOptionalString(process.env.NEXT_PUBLIC_SITE_ENV) ||
    toOptionalString(process.env.SITE_ENV) ||
    toOptionalString(process.env.NODE_ENV) ||
    "development"
}

function normalizeSiteConfig(
  input: SiteConfigInput,
  fallback: SiteConfig
): SiteConfig {
  return {
    site: {
      id: toOptionalString(input?.site?.id) || fallback.site.id,
      name: toOptionalString(input?.site?.name) || fallback.site.name,
      description:
        toOptionalString(input?.site?.description) || fallback.site.description,
      locale: toOptionalString(input?.site?.locale) || fallback.site.locale,
      currency:
        toOptionalString(input?.site?.currency).toLowerCase() ||
        fallback.site.currency,
      timezone: toOptionalString(input?.site?.timezone) || fallback.site.timezone,
    },
    domains: {
      storefront:
        toOptionalString(input?.domains?.storefront) || fallback.domains.storefront,
      api: toOptionalString(input?.domains?.api) || fallback.domains.api,
    },
    theme: {
      background:
        toOptionalString(input?.theme?.background) || fallback.theme.background,
      foreground:
        toOptionalString(input?.theme?.foreground) || fallback.theme.foreground,
      accent: toOptionalString(input?.theme?.accent) || fallback.theme.accent,
      accentSecondary:
        toOptionalString(input?.theme?.accentSecondary) ||
        toOptionalString(input?.theme?.accent_secondary) ||
        fallback.theme.accentSecondary,
      surface: toOptionalString(input?.theme?.surface) || fallback.theme.surface,
      surfaceMuted:
        toOptionalString(input?.theme?.surfaceMuted) ||
        toOptionalString(input?.theme?.surface_muted) ||
        fallback.theme.surfaceMuted,
    },
    content: {
      navigation: {
        products:
          toOptionalString(input?.content?.navigation?.products) ||
          fallback.content.navigation.products,
        orders:
          toOptionalString(input?.content?.navigation?.orders) ||
          fallback.content.navigation.orders,
        cart:
          toOptionalString(input?.content?.navigation?.cart) ||
          fallback.content.navigation.cart,
      },
      home: {
        headline:
          toOptionalString(input?.content?.home?.headline) ||
          fallback.content.home.headline,
        description:
          toOptionalString(input?.content?.home?.description) ||
          fallback.content.home.description,
        browseCta:
          toOptionalString(input?.content?.home?.browseCta) ||
          toOptionalString(input?.content?.home?.browse_cta) ||
          fallback.content.home.browseCta,
        ordersCta:
          toOptionalString(input?.content?.home?.ordersCta) ||
          toOptionalString(input?.content?.home?.orders_cta) ||
          fallback.content.home.ordersCta,
        productsHeading:
          toOptionalString(input?.content?.home?.productsHeading) ||
          toOptionalString(input?.content?.home?.products_heading) ||
          fallback.content.home.productsHeading,
        productsDescription:
          toOptionalString(input?.content?.home?.productsDescription) ||
          toOptionalString(input?.content?.home?.products_description) ||
          fallback.content.home.productsDescription,
        heroPattern:
          toOptionalString(input?.content?.home?.heroPattern) ||
          toOptionalString(input?.content?.home?.hero_pattern) ||
          fallback.content.home.heroPattern,
      },
    },
    platform: {
      enabledPlugins: toStringArray(
        input?.platform?.enabledPlugins || input?.platform?.enabled_plugins
      ),
      disabledPlugins: toStringArray(
        input?.platform?.disabledPlugins || input?.platform?.disabled_plugins
      ),
      enabledContracts: toStringArrayMap(
        input?.platform?.enabledContracts || input?.platform?.enabled_contracts
      ),
      disabledContracts: toStringArrayMap(
        input?.platform?.disabledContracts || input?.platform?.disabled_contracts
      ),
    },
  }
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(value.map((item) => toOptionalString(item)).filter(Boolean))
  )
}

function toStringArrayMap(value: unknown) {
  if (!value || typeof value !== "object") {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const normalized = entries.reduce<Record<string, string[]>>((acc, [key, names]) => {
    const capability = toOptionalString(key)

    if (!capability || !Array.isArray(names)) {
      return acc
    }

    const values = toStringArray(names)

    if (!values.length) {
      return acc
    }

    acc[capability] = values
    return acc
  }, {})

  return normalized
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
