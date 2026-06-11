import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { resetStorefrontExtensionsForTests } from "@/extensions/registry"
import type {
  SiteConfig,
  SiteExperienceSectionConfig,
} from "@/lib/site-config"
import type { ContentEntry, Product } from "@/lib/types"
import { HomeSections } from "./home"

const product: Product = {
  id: "prod_1",
  title: "Digital Access Kit",
  handle: "digital-access-kit",
  thumbnail: null,
  template: {
    code: "credential",
    title: "Credential",
    description: "Credential delivery",
    productType: "credential",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    deliveryLabel: "Instant access",
  },
  variants: [
    {
      id: "variant_1",
      title: "Default",
      available_quantity: 4,
      is_in_stock: true,
      calculated_price: {
        calculated_amount: 1900,
        currency_code: "usd",
      },
    },
  ],
}

const insight: ContentEntry = {
  id: "entry_1",
  site_id: "site-1",
  slug: "delivery-guide",
  title: "Delivery guide",
  excerpt: "How digital delivery works.",
  body: "How digital delivery works.",
  content_type: "guide",
  status: "published",
  author_name: "Atlas",
  topic: "Delivery",
  tags_json: [],
  related_product_handles_json: [],
  ai_assisted: false,
  published_at: null,
  created_at: null,
}

describe("HomeSections", () => {
  afterEach(() => {
    resetStorefrontExtensionsForTests()
  })

  it("renders home sections in the configured profile order", () => {
    const { container } = render(
      <HomeSections
        siteConfig={siteConfigWithSections([
          section("featured-products", "commerce-grid"),
          section("hero", "trust-led"),
          section("insights", "editorial-rail"),
        ])}
        featuredProducts={[product]}
        categoryLinks={[]}
        insights={[insight]}
      />
    )

    expect(sectionTypes(container)).toEqual([
      "featured-products",
      "hero",
      "insights",
    ])
    expect(screen.getByText("Shop now")).toBeInTheDocument()
    expect(screen.getByText("Recover order")).toBeInTheDocument()
  })

  it("skips disabled sections and empty optional sections", () => {
    const { container } = render(
      <HomeSections
        siteConfig={siteConfigWithSections([
          section("hero", "trust-led", false),
          section("categories", "commerce-links"),
          section("insights", "editorial-rail"),
          section("featured-products", "commerce-grid"),
        ])}
        featuredProducts={[product]}
        categoryLinks={[]}
        insights={[]}
      />
    )

    expect(sectionTypes(container)).toEqual(["featured-products"])
  })
})

function section(
  type: SiteExperienceSectionConfig["type"],
  variant: string,
  enabled = true
): SiteExperienceSectionConfig {
  return {
    type,
    variant,
    enabled,
  }
}

function sectionTypes(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-section-type]")).map(
    (node) => node.getAttribute("data-section-type")
  )
}

function siteConfigWithSections(
  sections: SiteExperienceSectionConfig[]
): SiteConfig {
  return {
    site: {
      id: "site-1",
      name: "Atlas Digital",
      description: "Digital goods store",
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
      background: "#ffffff",
      foreground: "#111827",
      accent: "#0f766e",
      accentSecondary: "#f97316",
      surface: "#ffffff",
      surfaceMuted: "#f3f4f6",
      border: "#e5e7eb",
      success: "#047857",
      danger: "#b91c1c",
      warning: "#b45309",
      radius: "8px",
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
        headline: "Digital goods store",
        description: "Buy digital products and recover orders without an account.",
        browseCta: "Shop now",
        ordersCta: "Recover order",
        productsHeading: "Products",
        productsDescription: "Available digital products.",
        insightsHeading: "Insights",
        insightsDescription: "Guides for buyers.",
        insightsCta: "Read insights",
        heroPattern: "",
        featuredLimit: 4,
        announcements: [],
      },
      categories: {
        heading: "Categories",
        description: "Browse by product type.",
        links: [],
      },
      catalog: {
        title: "Products",
        description: "Browse products.",
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
        description: "Guides.",
        emptyTitle: "No insights.",
        emptyDescription: "No insights.",
        readMoreLabel: "Read more",
        backLabel: "Back",
        relatedProductsLabel: "Related products",
        publishedLabel: "Published",
        seedEntries: [],
      },
    },
    experience: {
      foundation: "storefront-core",
      designTier: "80-point",
      strategy: "digital-goods-commerce",
      personality: ["clear"],
      guardrails: ["preserve checkout"],
      pages: {
        home: {
          intent: "Test home page",
          layout: "profile-section-stack",
          sections,
        },
        products: page("Catalog", "catalog-page"),
        "product-detail": page("Product detail", "product-detail-page"),
        cart: page("Cart", "cart-page"),
        checkout: page("Checkout", "checkout-page"),
        orders: page("Orders", "order-recovery-page"),
        insights: page("Insights", "content-index-page"),
        "insight-detail": page("Insight detail", "content-article-page"),
        account: page("Account", "account-page"),
        "account-login": page("Account login", "account-auth-page"),
        "account-reset-password": page("Password reset", "password-reset-page"),
      },
    },
    platform: {
      enabledPlugins: [],
      disabledPlugins: [],
      enabledContracts: {},
      disabledContracts: {},
    },
  }
}

function page(intent: string, layout: string) {
  return {
    intent,
    layout,
    sections: [],
  }
}
