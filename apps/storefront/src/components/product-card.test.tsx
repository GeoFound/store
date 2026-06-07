import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProductCard } from "./product-card"
import type { Product } from "@/lib/types"

const baseProduct: Product = {
  id: "prod_1",
  title: "Atlas Gift Card",
  handle: "atlas-gift-card",
  thumbnail: null,
  template: {
    code: "gift-card",
    title: "Gift card",
    description: "Gift card template",
    productType: "gift_card",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    deliveryLabel: "Delivered by email",
  },
  variants: [
    {
      id: "variant_1",
      title: "Default",
      available_quantity: 5,
      is_in_stock: true,
      calculated_price: {
        calculated_amount: 2500,
        currency_code: "usd",
      },
    },
  ],
}

describe("ProductCard", () => {
  it("links to the product detail page and renders product metadata", () => {
    render(<ProductCard product={baseProduct} />)

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/products/atlas-gift-card"
    )
    expect(screen.getByText("Atlas Gift Card")).toBeInTheDocument()
    expect(screen.getByText("Delivered by email")).toBeInTheDocument()
    expect(screen.getByText("$25.00")).toBeInTheDocument()
    expect(screen.getByText("Gift card")).toBeInTheDocument()
  })

  it("marks sold-out products as unavailable", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          isSoldOut: true,
        }}
      />
    )

    expect(screen.getByText("Sold out")).toBeInTheDocument()
    expect(screen.getByText("Unavailable")).toBeInTheDocument()
  })
})
