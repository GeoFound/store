import { reloadlySupplierProvider } from "../provider"

describe("reloadly supplier provider", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("exposes static quotes from mapping and metadata", () => {
    expect(
      reloadlySupplierProvider.quote?.({
        providerSku: "sku_1",
        quantity: 1,
        currency: "usd",
        metadata: {
          supplier_unit_cost: 450,
        },
        mapping: {
          provider_product_id: "product_1",
        },
      })
    ).toMatchObject({
      available: true,
      providerSku: "sku_1",
      providerProductId: "product_1",
      unitCost: 450,
      currency: "usd",
    })
  })

  it("reports whether credentials are configured", () => {
    process.env = {
      ...originalEnv,
      RELOADLY_CLIENT_ID: "client_1",
      RELOADLY_CLIENT_SECRET: "secret_1",
    }

    expect(reloadlySupplierProvider.isConfigured?.()).toBe(true)
  })
})
