import { g2aSupplierProvider } from "../provider"

describe("g2a supplier provider", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("exposes static quotes from mapping and metadata", () => {
    expect(
      g2aSupplierProvider.quote?.({
        providerSku: "sku_1",
        quantity: 1,
        currency: "eur",
        metadata: {
          supplier_unit_cost: 250,
        },
        mapping: {
          provider_product_id: "product_1",
        },
      })
    ).toMatchObject({
      available: true,
      providerSku: "sku_1",
      providerProductId: "product_1",
      unitCost: 250,
      currency: "eur",
    })
  })

  it("reports whether credentials are configured", () => {
    process.env = {
      ...originalEnv,
      G2A_ACCESS_TOKEN: "token_1",
    }

    expect(g2aSupplierProvider.isConfigured?.()).toBe(true)
  })
})
