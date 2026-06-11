import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type {
  SiteConfig,
  SiteExperienceSectionConfig,
} from "@/lib/site-config"
import type { Product } from "@/lib/types"
import { ProductsSections } from "./products"

const product: Product = {
  id: "prod_1",
  title: "Digital Card",
  handle: "digital-card",
  thumbnail: null,
  template: {
    code: "credential",
    title: "Digital delivery",
    description: "Credential delivery",
    productType: "credential",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    deliveryLabel: "Instant access",
  },
  variants: [
    {
      id: "variant_1",
      title: "Default",
      available_quantity: 3,
      calculated_price: {
        calculated_amount: 1000,
        currency_code: "usd",
      },
    },
  ],
}

describe("ProductsSections", () => {
  it("renders configured product sections in order and skips disabled sections", () => {
    const { container } = render(
      <ProductsSections
        siteConfig={siteConfigWithProductSections([
          section("product-grid", "commerce-grid"),
          section("catalog-controls", "category-sort", false),
          section("catalog-header", "standard"),
        ])}
        products={[product]}
        categoryFilters={[{ key: "cards", label: "Cards" }]}
        activeCategory=""
        activeSort="default"
      />
    )

    expect(sectionTypes(container)).toEqual(["product-grid", "catalog-header"])
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

function siteConfigWithProductSections(
  sections: SiteExperienceSectionConfig[]
): SiteConfig {
  return {
    site: {
      name: "Atlas Digital",
    },
    content: {
      catalog: {
        title: "Products",
        description: "Browse products.",
        allProductsLabel: "All products",
        sortLabel: "Sort",
        sortDefaultLabel: "Default",
        sortPriceAscLabel: "Price low to high",
        sortPriceDescLabel: "Price high to low",
        sortNewestLabel: "Newest",
      },
    },
    experience: {
      pages: {
        products: {
          sections,
        },
      },
    },
  } as SiteConfig
}
