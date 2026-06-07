import fs from "node:fs"
import path from "node:path"
import { cache } from "react"

export type SiteThemeConfig = {
  id: string
  background: string
  foreground: string
  accent: string
  accentSecondary: string
  surface: string
  surfaceMuted: string
  border: string
  success: string
  danger: string
  warning: string
  radius: string
  density: "comfortable" | "compact"
}

export type SiteAnnouncementConfig = {
  title: string
  body: string
  tone: "info" | "success" | "warning"
}

export type SiteCategoryLinkConfig = {
  label: string
  href: string
  description?: string
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
    featuredLimit: number
    announcements: SiteAnnouncementConfig[]
  }
  categories: {
    heading: string
    description: string
    links: SiteCategoryLinkConfig[]
  }
  catalog: {
    title: string
    description: string
    allProductsLabel: string
    sortLabel: string
    sortDefaultLabel: string
    sortPriceAscLabel: string
    sortPriceDescLabel: string
    sortNewestLabel: string
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
      featured_limit?: unknown
      announcements?: unknown
    }
    categories?: Partial<SiteContentConfig["categories"]> & {
      links?: unknown
    }
    catalog?: Partial<SiteContentConfig["catalog"]> & {
      all_products_label?: string
      sort_label?: string
      sort_default_label?: string
      sort_price_asc_label?: string
      sort_price_desc_label?: string
      sort_newest_label?: string
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
    id: "base",
    background: "#f7f5f0",
    foreground: "#1c1917",
    accent: "#0f766e",
    accentSecondary: "#f97316",
    surface: "#ffffff",
    surfaceMuted: "#f5f5f4",
    border: "#e7e5e4",
    success: "#047857",
    danger: "#b91c1c",
    warning: "#b45309",
    radius: "6px",
    density: "comfortable",
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
      featuredLimit: 6,
      announcements: [],
    },
    categories: {
      heading: "Shop by category",
      description: "Use the storefront profile to pin important product groups.",
      links: [],
    },
    catalog: {
      title: "Products",
      description:
        "Guest checkout is supported. Add a product, enter an email, and pay without creating an account.",
      allProductsLabel: "All products",
      sortLabel: "Sort",
      sortDefaultLabel: "Default",
      sortPriceAscLabel: "Price low to high",
      sortPriceDescLabel: "Price high to low",
      sortNewestLabel: "Newest",
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
  const baseConfig: SiteConfig = {
    ...BASE_SITE_CONFIG,
    site: {
      ...BASE_SITE_CONFIG.site,
      id: siteId,
    },
  }
  const filePath = resolveSiteProfilePath(siteId, siteEnv)

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Site profile not found for SITE_ID=${siteId} SITE_ENV=${siteEnv}. Expected:\n- ${filePath}`
    )
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8")
    const parsed = JSON.parse(raw) as SiteConfigInput
    validateSiteConfigInput(parsed, {
      expectedSiteId: siteId,
      filePath,
    })
    return normalizeSiteConfig(parsed, baseConfig)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error"

    throw new Error(
      `Failed to load site profile for SITE_ID=${siteId} SITE_ENV=${siteEnv}: ${message}`
    )
  }
})

function resolveSiteProfilePath(siteId: string, siteEnv: string) {
  const root = resolveProfilesRoot()
  return path.join(root, siteId, siteEnv, "site.json")
}

function resolveProfilesRoot() {
  const explicitRoot = toOptionalString(process.env.SITE_PROFILES_ROOT)

  if (explicitRoot) {
    return path.resolve(explicitRoot)
  }

  return path.resolve(process.cwd(), "..", "..", "profiles", "sites")
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
      id: toOptionalString(input?.theme?.id) || fallback.theme.id,
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
      border: toOptionalString(input?.theme?.border) || fallback.theme.border,
      success: toOptionalString(input?.theme?.success) || fallback.theme.success,
      danger: toOptionalString(input?.theme?.danger) || fallback.theme.danger,
      warning: toOptionalString(input?.theme?.warning) || fallback.theme.warning,
      radius: toOptionalString(input?.theme?.radius) || fallback.theme.radius,
      density: normalizeThemeDensity(input?.theme?.density, fallback.theme.density),
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
        featuredLimit:
          toPositiveInteger(
            input?.content?.home?.featuredLimit ||
              input?.content?.home?.featured_limit
          ) || fallback.content.home.featuredLimit,
        announcements:
          toAnnouncementArray(input?.content?.home?.announcements) ||
          fallback.content.home.announcements,
      },
      categories: {
        heading:
          toOptionalString(input?.content?.categories?.heading) ||
          fallback.content.categories.heading,
        description:
          toOptionalString(input?.content?.categories?.description) ||
          fallback.content.categories.description,
        links:
          toCategoryLinkArray(input?.content?.categories?.links) ??
          fallback.content.categories.links,
      },
      catalog: {
        title:
          toOptionalString(input?.content?.catalog?.title) ||
          fallback.content.catalog.title,
        description:
          toOptionalString(input?.content?.catalog?.description) ||
          fallback.content.catalog.description,
        allProductsLabel:
          toOptionalString(input?.content?.catalog?.allProductsLabel) ||
          toOptionalString(input?.content?.catalog?.all_products_label) ||
          fallback.content.catalog.allProductsLabel,
        sortLabel:
          toOptionalString(input?.content?.catalog?.sortLabel) ||
          toOptionalString(input?.content?.catalog?.sort_label) ||
          fallback.content.catalog.sortLabel,
        sortDefaultLabel:
          toOptionalString(input?.content?.catalog?.sortDefaultLabel) ||
          toOptionalString(input?.content?.catalog?.sort_default_label) ||
          fallback.content.catalog.sortDefaultLabel,
        sortPriceAscLabel:
          toOptionalString(input?.content?.catalog?.sortPriceAscLabel) ||
          toOptionalString(input?.content?.catalog?.sort_price_asc_label) ||
          fallback.content.catalog.sortPriceAscLabel,
        sortPriceDescLabel:
          toOptionalString(input?.content?.catalog?.sortPriceDescLabel) ||
          toOptionalString(input?.content?.catalog?.sort_price_desc_label) ||
          fallback.content.catalog.sortPriceDescLabel,
        sortNewestLabel:
          toOptionalString(input?.content?.catalog?.sortNewestLabel) ||
          toOptionalString(input?.content?.catalog?.sort_newest_label) ||
          fallback.content.catalog.sortNewestLabel,
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

function toAnnouncementArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const announcements = value
    .map((item): SiteAnnouncementConfig | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const source = item as Record<string, unknown>
      const title = toOptionalString(source.title)
      const body = toOptionalString(source.body)

      if (!title || !body) {
        return null
      }

      return {
        title,
        body,
        tone: normalizeAnnouncementTone(source.tone),
      }
    })
    .filter((item): item is SiteAnnouncementConfig => Boolean(item))

  return announcements.length ? announcements : undefined
}

function toCategoryLinkArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const links = value
    .map((item): SiteCategoryLinkConfig | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const source = item as Record<string, unknown>
      const label = toOptionalString(source.label)
      const href = toOptionalString(source.href)

      if (!label || !href) {
        return null
      }

      const link: SiteCategoryLinkConfig = {
        label,
        href,
      }

      const description = toOptionalString(source.description)
      if (description) {
        link.description = description
      }

      return link
    })
    .filter((item): item is SiteCategoryLinkConfig => Boolean(item))

  return links.length ? links : undefined
}

function toPositiveInteger(value: unknown) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return undefined
  }

  return Math.floor(numberValue)
}

function normalizeAnnouncementTone(value: unknown): SiteAnnouncementConfig["tone"] {
  return value === "success" || value === "warning" ? value : "info"
}

function normalizeThemeDensity(
  value: unknown,
  fallback: SiteThemeConfig["density"]
) {
  return value === "compact" || value === "comfortable" ? value : fallback
}

function validateSiteConfigInput(
  input: SiteConfigInput,
  context: {
    expectedSiteId: string
    filePath: string
  }
) {
  assertPlainObject(input, "Profile", context.filePath)
  assertNonEmptyString(input.site?.id, "site.id", context.filePath)

  if (input.site?.id !== context.expectedSiteId) {
    throw new Error(
      `site.id mismatch in ${context.filePath}: expected ${context.expectedSiteId}, got ${input.site?.id}`
    )
  }

  assertNonEmptyString(input.site?.name, "site.name", context.filePath)
  assertNonEmptyString(
    input.site?.description,
    "site.description",
    context.filePath
  )
  assertNonEmptyString(
    input.domains?.storefront,
    "domains.storefront",
    context.filePath
  )
  assertNonEmptyString(input.domains?.api, "domains.api", context.filePath)
  assertPlainObject(input.theme, "theme", context.filePath)
  assertPlainObject(input.content, "content", context.filePath)
  assertPlainObject(input.platform, "platform", context.filePath)
  assertNonEmptyString(
    input.theme?.background,
    "theme.background",
    context.filePath
  )
  assertNonEmptyString(
    input.theme?.foreground,
    "theme.foreground",
    context.filePath
  )
  assertNonEmptyString(input.theme?.accent, "theme.accent", context.filePath)

  if (
    typeof input.content?.home?.announcements !== "undefined" &&
    !Array.isArray(input.content.home.announcements)
  ) {
    throw new Error(
      `content.home.announcements must be an array in ${context.filePath}`
    )
  }

  if (
    typeof input.content?.categories?.links !== "undefined" &&
    !Array.isArray(input.content.categories.links)
  ) {
    throw new Error(
      `content.categories.links must be an array in ${context.filePath}`
    )
  }
}

function assertPlainObject(value: unknown, field: string, filePath: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object in ${filePath}`)
  }
}

function assertNonEmptyString(
  value: unknown,
  field: string,
  filePath: string
) {
  if (!toOptionalString(value)) {
    throw new Error(`${field} is required in ${filePath}`)
  }
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
