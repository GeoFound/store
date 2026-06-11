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

export type SiteInsightEntryConfig = {
  slug: string
  title: string
  excerpt: string
  body: string
  contentType: string
  topic?: string
  tags: string[]
  authorName?: string
  publishedAt?: string
  relatedProductHandles: string[]
}

export type SiteProductDisplayConfig = {
  handle: string
  title?: string
  description?: string
  deliveryLabel?: string
  fulfillmentTitle?: string
  fulfillmentDescription?: string
  thumbnail?: string
  hideThumbnail: boolean
  hideVariantSelector: boolean
}

export type SiteExperiencePageKey =
  | "home"
  | "products"
  | "product-detail"
  | "cart"
  | "checkout"
  | "orders"
  | "insights"
  | "insight-detail"
  | "account"
  | "account-login"
  | "account-reset-password"

export type SiteExperienceSectionType =
  | "hero"
  | "categories"
  | "insights"
  | "featured-products"
  | "catalog-header"
  | "catalog-controls"
  | "product-grid"
  | "product-media"
  | "product-purchase"
  | "product-details"
  | "cart-items"
  | "cart-summary"
  | "checkout-form"
  | "checkout-summary"
  | "order-recovery"
  | "content-list"
  | "content-article"
  | "account-auth"
  | "account-overview"
  | "password-reset"
  | "support-assurance"

export type SiteExperienceSectionConfig = {
  type: SiteExperienceSectionType
  variant: string
  enabled: boolean
  goal?: string
}

export type SiteExperiencePageConfig = {
  intent: string
  layout: string
  sections: SiteExperienceSectionConfig[]
}

export type SiteExperienceConfig = {
  foundation: string
  designTier: string
  strategy: string
  personality: string[]
  guardrails: string[]
  pages: Record<SiteExperiencePageKey, SiteExperiencePageConfig>
}

export type SiteContentConfig = {
  navigation: {
    insights: string
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
    insightsHeading: string
    insightsDescription: string
    insightsCta: string
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
    productDisplay: SiteProductDisplayConfig[]
  }
  insights: {
    title: string
    description: string
    emptyTitle: string
    emptyDescription: string
    readMoreLabel: string
    backLabel: string
    relatedProductsLabel: string
    publishedLabel: string
    seedEntries: SiteInsightEntryConfig[]
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
  experience: SiteExperienceConfig
  platform: {
    enabledPlugins: string[]
    disabledPlugins: string[]
    enabledContracts: Record<string, string[]>
    disabledContracts: Record<string, string[]>
  }
}

type SiteExperienceConfigInput = Partial<
  Omit<SiteExperienceConfig, "designTier" | "personality" | "guardrails" | "pages">
> & {
  designTier?: unknown
  design_tier?: unknown
  personality?: unknown
  guardrails?: unknown
  pages?: Partial<Record<SiteExperiencePageKey, SiteExperiencePageConfigInput>>
}

type SiteExperiencePageConfigInput = {
  intent?: unknown
  layout?: unknown
  sections?: unknown
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
      insights_heading?: string
      insights_description?: string
      insights_cta?: string
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
      product_display?: unknown
    }
    insights?: Partial<SiteContentConfig["insights"]> & {
      empty_title?: string
      empty_description?: string
      read_more_label?: string
      back_label?: string
      related_products_label?: string
      published_label?: string
      seed_entries?: unknown
    }
  }
  experience?: SiteExperienceConfigInput
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
      insights: "Insights",
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
      insightsHeading: "Latest insights",
      insightsDescription: "Editorial content published through content-core.",
      insightsCta: "View all insights",
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
      productDisplay: [],
    },
    insights: {
      title: "Insights",
      description: "Articles, guides, and resources from this site.",
      emptyTitle: "No insights published yet.",
      emptyDescription:
        "Create and publish content entries from the backend content panel.",
      readMoreLabel: "Read more",
      backLabel: "Back to insights",
      relatedProductsLabel: "Related products",
      publishedLabel: "Published",
      seedEntries: [],
    },
  },
  experience: {
    foundation: "storefront-core",
    designTier: "80-point",
    strategy: "digital-goods-commerce",
    personality: ["clear", "trustworthy", "fast"],
    guardrails: [
      "preserve cart, checkout, order lookup, and delivery access flows",
      "prefer semantic sections over arbitrary visual slicing",
      "keep site personality in profile configuration and shared UX in code",
      "verify desktop and mobile storefront states before production promotion",
    ],
    pages: {
      home: {
        intent: "Introduce the site promise and route buyers into product discovery, content, or order lookup.",
        layout: "profile-section-stack",
        sections: [
          {
            type: "hero",
            variant: "adaptive-trust",
            enabled: true,
            goal: "State the site promise and route buyers to catalog or order lookup.",
          },
          {
            type: "categories",
            variant: "commerce-links",
            enabled: true,
            goal: "Expose configured or derived product groups.",
          },
          {
            type: "insights",
            variant: "editorial-rail",
            enabled: true,
            goal: "Use content to build trust and discovery.",
          },
          {
            type: "featured-products",
            variant: "commerce-grid",
            enabled: true,
            goal: "Show purchasable products using the shared product card system.",
          },
        ],
      },
      products: {
        intent: "Help buyers scan, filter, sort, and enter product detail pages.",
        layout: "catalog-page",
        sections: [
          {
            type: "catalog-header",
            variant: "standard",
            enabled: true,
            goal: "State catalog scope and buyer expectations.",
          },
          {
            type: "catalog-controls",
            variant: "category-sort",
            enabled: true,
            goal: "Support category filtering and sort without hiding products.",
          },
          {
            type: "product-grid",
            variant: "commerce-grid",
            enabled: true,
            goal: "Render products through the shared product card system.",
          },
        ],
      },
      "product-detail": {
        intent: "Help buyers evaluate one product and add the right variant to cart.",
        layout: "product-detail-page",
        sections: [
          {
            type: "product-media",
            variant: "stable-frame",
            enabled: true,
            goal: "Show product imagery or fallback identity without layout shift.",
          },
          {
            type: "product-purchase",
            variant: "digital-delivery",
            enabled: true,
            goal: "Show price, availability, delivery facts, and add-to-cart action.",
          },
          {
            type: "product-details",
            variant: "plain-language",
            enabled: true,
            goal: "Explain product details and fulfillment in buyer language.",
          },
        ],
      },
      cart: {
        intent: "Let buyers review cart contents and proceed or return to catalog.",
        layout: "cart-page",
        sections: [
          {
            type: "cart-items",
            variant: "editable-list",
            enabled: true,
            goal: "Show cart lines with quantities and prices.",
          },
          {
            type: "cart-summary",
            variant: "checkout-cta",
            enabled: true,
            goal: "Summarize totals and expose checkout action.",
          },
        ],
      },
      checkout: {
        intent: "Complete guest checkout with minimal distraction and clear payment recovery.",
        layout: "checkout-page",
        sections: [
          {
            type: "checkout-form",
            variant: "guest-first",
            enabled: true,
            goal: "Collect buyer email and payment method with clear errors.",
          },
          {
            type: "checkout-summary",
            variant: "persistent-order-summary",
            enabled: true,
            goal: "Keep order totals and payment state visible.",
          },
        ],
      },
      orders: {
        intent: "Recover order access without requiring an account.",
        layout: "order-recovery-page",
        sections: [
          {
            type: "order-recovery",
            variant: "guest-access",
            enabled: true,
            goal: "Guide buyers through email and recovery code based access.",
          },
          {
            type: "support-assurance",
            variant: "delivery-help",
            enabled: true,
            goal: "Explain how delivery and recovery work.",
          },
        ],
      },
      insights: {
        intent: "Let visitors browse public content that supports trust and discovery.",
        layout: "content-index-page",
        sections: [
          {
            type: "content-list",
            variant: "editorial-grid",
            enabled: true,
            goal: "Show published content entries for the current site.",
          },
        ],
      },
      "insight-detail": {
        intent: "Present one content entry and route readers back to related discovery.",
        layout: "content-article-page",
        sections: [
          {
            type: "content-article",
            variant: "readable-article",
            enabled: true,
            goal: "Render article content with readable hierarchy.",
          },
          {
            type: "featured-products",
            variant: "related-products",
            enabled: true,
            goal: "Show related products when content references them.",
          },
        ],
      },
      account: {
        intent: "Provide lightweight optional account access without replacing guest recovery.",
        layout: "account-page",
        sections: [
          {
            type: "account-overview",
            variant: "lightweight",
            enabled: true,
            goal: "Show basic profile and order access links when accounts are enabled.",
          },
        ],
      },
      "account-login": {
        intent: "Let buyers sign in or register when optional accounts are enabled.",
        layout: "account-auth-page",
        sections: [
          {
            type: "account-auth",
            variant: "email-first",
            enabled: true,
            goal: "Support login and registration without weakening guest checkout.",
          },
        ],
      },
      "account-reset-password": {
        intent: "Recover optional account access with minimal friction.",
        layout: "password-reset-page",
        sections: [
          {
            type: "password-reset",
            variant: "recovery-link",
            enabled: true,
            goal: "Request and confirm password reset through recovery links.",
          },
        ],
      },
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
        insights:
          toOptionalString(input?.content?.navigation?.insights) ||
          fallback.content.navigation.insights,
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
        insightsHeading:
          toOptionalString(input?.content?.home?.insightsHeading) ||
          toOptionalString(input?.content?.home?.insights_heading) ||
          fallback.content.home.insightsHeading,
        insightsDescription:
          toOptionalString(input?.content?.home?.insightsDescription) ||
          toOptionalString(input?.content?.home?.insights_description) ||
          fallback.content.home.insightsDescription,
        insightsCta:
          toOptionalString(input?.content?.home?.insightsCta) ||
          toOptionalString(input?.content?.home?.insights_cta) ||
          fallback.content.home.insightsCta,
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
        productDisplay:
          toProductDisplayArray(
            input?.content?.catalog?.productDisplay ||
              input?.content?.catalog?.product_display
          ) ?? fallback.content.catalog.productDisplay,
      },
      insights: {
        title:
          toOptionalString(input?.content?.insights?.title) ||
          fallback.content.insights.title,
        description:
          toOptionalString(input?.content?.insights?.description) ||
          fallback.content.insights.description,
        emptyTitle:
          toOptionalString(input?.content?.insights?.emptyTitle) ||
          toOptionalString(input?.content?.insights?.empty_title) ||
          fallback.content.insights.emptyTitle,
        emptyDescription:
          toOptionalString(input?.content?.insights?.emptyDescription) ||
          toOptionalString(input?.content?.insights?.empty_description) ||
          fallback.content.insights.emptyDescription,
        readMoreLabel:
          toOptionalString(input?.content?.insights?.readMoreLabel) ||
          toOptionalString(input?.content?.insights?.read_more_label) ||
          fallback.content.insights.readMoreLabel,
        backLabel:
          toOptionalString(input?.content?.insights?.backLabel) ||
          toOptionalString(input?.content?.insights?.back_label) ||
          fallback.content.insights.backLabel,
        relatedProductsLabel:
          toOptionalString(input?.content?.insights?.relatedProductsLabel) ||
          toOptionalString(input?.content?.insights?.related_products_label) ||
          fallback.content.insights.relatedProductsLabel,
        publishedLabel:
          toOptionalString(input?.content?.insights?.publishedLabel) ||
          toOptionalString(input?.content?.insights?.published_label) ||
          fallback.content.insights.publishedLabel,
        seedEntries:
          toInsightEntryArray(
            input?.content?.insights?.seedEntries ||
              input?.content?.insights?.seed_entries
          ) ?? fallback.content.insights.seedEntries,
      },
    },
    experience: normalizeSiteExperienceConfig(
      input?.experience,
      fallback.experience
    ),
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

const STOREFRONT_EXPERIENCE_PAGE_KEYS: SiteExperiencePageKey[] = [
  "home",
  "products",
  "product-detail",
  "cart",
  "checkout",
  "orders",
  "insights",
  "insight-detail",
  "account",
  "account-login",
  "account-reset-password",
]

const EXPERIENCE_SECTION_TYPES = new Set<SiteExperienceSectionType>([
  "hero",
  "categories",
  "insights",
  "featured-products",
  "catalog-header",
  "catalog-controls",
  "product-grid",
  "product-media",
  "product-purchase",
  "product-details",
  "cart-items",
  "cart-summary",
  "checkout-form",
  "checkout-summary",
  "order-recovery",
  "content-list",
  "content-article",
  "account-auth",
  "account-overview",
  "password-reset",
  "support-assurance",
])

function normalizeSiteExperienceConfig(
  input: SiteExperienceConfigInput | undefined,
  fallback: SiteExperienceConfig
): SiteExperienceConfig {
  const personality = toStringArray(input?.personality)
  const guardrails = toStringArray(input?.guardrails)

  return {
    foundation: toOptionalString(input?.foundation) || fallback.foundation,
    designTier:
      toOptionalString(input?.designTier) ||
      toOptionalString(input?.design_tier) ||
      fallback.designTier,
    strategy: toOptionalString(input?.strategy) || fallback.strategy,
    personality: personality.length ? personality : fallback.personality,
    guardrails: guardrails.length ? guardrails : fallback.guardrails,
    pages: normalizeExperiencePages(input?.pages, fallback.pages),
  }
}

function normalizeExperiencePages(
  inputPages: SiteExperienceConfigInput["pages"],
  fallbackPages: SiteExperienceConfig["pages"]
) {
  return STOREFRONT_EXPERIENCE_PAGE_KEYS.reduce<SiteExperienceConfig["pages"]>(
    (acc, key) => {
      acc[key] = normalizeExperiencePage(inputPages?.[key], fallbackPages[key])
      return acc
    },
    {} as SiteExperienceConfig["pages"]
  )
}

function normalizeExperiencePage(
  input: SiteExperiencePageConfigInput | undefined,
  fallback: SiteExperiencePageConfig
): SiteExperiencePageConfig {
  return {
    intent: toOptionalString(input?.intent) || fallback.intent,
    layout: toOptionalString(input?.layout) || fallback.layout,
    sections: toExperienceSectionArray(input?.sections) ?? fallback.sections,
  }
}

function toExperienceSectionArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const sections = value
    .map((item): SiteExperienceSectionConfig | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const source = item as Record<string, unknown>
      const type = normalizeExperienceSectionType(source.type)

      if (!type) {
        return null
      }

      const section: SiteExperienceSectionConfig = {
        type,
        variant: toOptionalString(source.variant) || "default",
        enabled: source.enabled !== false,
      }

      const goal = toOptionalString(source.goal)
      if (goal) {
        section.goal = goal
      }

      return section
    })
    .filter((item): item is SiteExperienceSectionConfig => Boolean(item))

  return sections.length ? sections : undefined
}

function normalizeExperienceSectionType(value: unknown) {
  const normalized = toOptionalString(value).toLowerCase().replace(/_/g, "-")

  return EXPERIENCE_SECTION_TYPES.has(normalized as SiteExperienceSectionType)
    ? (normalized as SiteExperienceSectionType)
    : undefined
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

function toProductDisplayArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const entries = value
    .map((item): SiteProductDisplayConfig | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const source = item as Record<string, unknown>
      const handle = toOptionalString(source.handle)

      if (!handle) {
        return null
      }

      return {
        handle,
        title: toOptionalString(source.title) || undefined,
        description: toOptionalString(source.description) || undefined,
        deliveryLabel:
          toOptionalString(source.deliveryLabel) ||
          toOptionalString(source.delivery_label) ||
          undefined,
        fulfillmentTitle:
          toOptionalString(source.fulfillmentTitle) ||
          toOptionalString(source.fulfillment_title) ||
          undefined,
        fulfillmentDescription:
          toOptionalString(source.fulfillmentDescription) ||
          toOptionalString(source.fulfillment_description) ||
          undefined,
        thumbnail: toOptionalString(source.thumbnail) || undefined,
        hideThumbnail:
          source.hideThumbnail === true || source.hide_thumbnail === true,
        hideVariantSelector:
          source.hideVariantSelector === true ||
          source.hide_variant_selector === true,
      }
    })
    .filter((item): item is SiteProductDisplayConfig => Boolean(item))

  return entries.length ? entries : undefined
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

function toInsightEntryArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const entries = value
    .map((item): SiteInsightEntryConfig | null => {
      if (!item || typeof item !== "object") {
        return null
      }

      const source = item as Record<string, unknown>
      const slug = toOptionalString(source.slug)
      const title = toOptionalString(source.title)
      const excerpt = toOptionalString(source.excerpt)
      const body = toOptionalString(source.body)

      if (!slug || !title || !excerpt || !body) {
        return null
      }

      return {
        slug,
        title,
        excerpt,
        body,
        contentType:
          toOptionalString(source.contentType) ||
          toOptionalString(source.content_type) ||
          "article",
        topic: toOptionalString(source.topic) || undefined,
        tags: toStringArray(source.tags),
        authorName:
          toOptionalString(source.authorName) ||
          toOptionalString(source.author_name) ||
          undefined,
        publishedAt:
          toOptionalString(source.publishedAt) ||
          toOptionalString(source.published_at) ||
          undefined,
        relatedProductHandles: toStringArray(
          source.relatedProductHandles || source.related_product_handles
        ),
      }
    })
    .filter((item): item is SiteInsightEntryConfig => Boolean(item))

  return entries.length ? entries : undefined
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

  if (
    typeof input.content?.insights?.seedEntries !== "undefined" &&
    !Array.isArray(input.content.insights.seedEntries)
  ) {
    throw new Error(
      `content.insights.seedEntries must be an array in ${context.filePath}`
    )
  }

  if (
    typeof input.content?.insights?.seed_entries !== "undefined" &&
    !Array.isArray(input.content.insights.seed_entries)
  ) {
    throw new Error(
      `content.insights.seed_entries must be an array in ${context.filePath}`
    )
  }

  if (typeof input.experience !== "undefined") {
    assertPlainObject(input.experience, "experience", context.filePath)
  }

  if (
    typeof input.experience?.personality !== "undefined" &&
    !Array.isArray(input.experience.personality)
  ) {
    throw new Error(`experience.personality must be an array in ${context.filePath}`)
  }

  if (
    typeof input.experience?.guardrails !== "undefined" &&
    !Array.isArray(input.experience.guardrails)
  ) {
    throw new Error(`experience.guardrails must be an array in ${context.filePath}`)
  }

  if (typeof input.experience?.pages !== "undefined") {
    assertPlainObject(input.experience.pages, "experience.pages", context.filePath)

    for (const [pageKey, pageConfig] of Object.entries(input.experience.pages)) {
      if (typeof pageConfig === "undefined") {
        continue
      }

      assertPlainObject(
        pageConfig,
        `experience.pages.${pageKey}`,
        context.filePath
      )

      if (
        typeof pageConfig.sections !== "undefined" &&
        !Array.isArray(pageConfig.sections)
      ) {
        throw new Error(
          `experience.pages.${pageKey}.sections must be an array in ${context.filePath}`
        )
      }
    }
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
