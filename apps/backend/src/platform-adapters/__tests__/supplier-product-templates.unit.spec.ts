import {
  getLocalizedProductTemplate,
  getProductTemplate,
  resetProductTemplatesForTests,
} from "../../platform/product-templates"
import {
  ensureSupplierProductTemplatesRegistered,
  resetSupplierProductTemplatesForTests,
} from "../../modules/supplier-procurement/templates"

describe("supplier product template adapter", () => {
  beforeEach(() => {
    resetProductTemplatesForTests()
    resetSupplierProductTemplatesForTests()
  })

  it("registers supplier-backed templates without changing core defaults", () => {
    ensureSupplierProductTemplatesRegistered()

    expect(getProductTemplate("reloadly-gift-card")).toMatchObject({
      code: "reloadly-gift-card",
      fulfillmentPolicyCode: "external-api",
      deliveryHandlerCode: "supplier-procurement",
      inventoryHandlerCode: "noop",
    })
    expect(getLocalizedProductTemplate("reloadly-gift-card", "zh-CN")).toMatchObject({
      title: "Reloadly 礼品卡",
    })
    expect(getProductTemplate("g2a-key")).toMatchObject({
      code: "g2a-key",
      fulfillmentPolicyCode: "external-api",
    })
  })
})
