import { describe, expect, it } from "vitest"
import {
  allowedExperienceSectionsForPage,
  isExperiencePageKey,
  isExperienceSectionAllowedForPage,
  isExperienceSectionType,
  STOREFRONT_EXPERIENCE_PAGE_KEYS,
} from "./storefront-experience-contract"

describe("storefront experience contract", () => {
  it("loads page and section contracts from the machine-readable policy", () => {
    expect(STOREFRONT_EXPERIENCE_PAGE_KEYS).toContain("home")
    expect(isExperiencePageKey("checkout")).toBe(true)
    expect(isExperienceSectionType("checkout-form")).toBe(true)
  })

  it("constrains sections to the pages that can render them", () => {
    expect(allowedExperienceSectionsForPage("home")).toEqual([
      "hero",
      "categories",
      "insights",
      "featured-products",
    ])
    expect(isExperienceSectionAllowedForPage("home", "hero")).toBe(true)
    expect(isExperienceSectionAllowedForPage("home", "checkout-form")).toBe(
      false
    )
  })
})
