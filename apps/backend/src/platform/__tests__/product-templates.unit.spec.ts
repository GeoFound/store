import {
  ensureSupplierProductTemplatesRegistered,
  resetSupplierProductTemplatesForTests,
} from "../../modules/supplier-procurement/templates"
import {
  getProductTemplate,
  listProductTemplates,
  registerProductTemplate,
  resetProductTemplatesForTests,
  resolveProductTemplate,
} from "../product-templates"

describe("product templates", () => {
  beforeEach(() => {
    resetProductTemplatesForTests()
    resetSupplierProductTemplatesForTests()
  })

  it("registers default templates on first access", () => {
    const templates = listProductTemplates()

    expect(templates.map((template) => template.code)).toEqual([
      "credential",
      "account",
      "license",
      "code",
      "file",
      "manual",
      "api",
    ])
  })

  it("resolves a registered custom template code without changing core flow code", () => {
    registerProductTemplate({
      code: "gift-card",
      title: "Gift Card",
      description: "Stored-value gift card delivery.",
      productType: "gift_card",
      fulfillmentPolicyCode: "gift-card",
      deliveryHandlerCode: "code",
    })

    expect(getProductTemplate("gift-card")).toMatchObject({
      code: "gift-card",
      productType: "gift_card",
      fulfillmentPolicyCode: "gift-card",
      deliveryHandlerCode: "code",
    })

    expect(
      resolveProductTemplate({
        metadata: {
          template_code: "gift-card",
        },
      })
    ).toMatchObject({
      code: "gift-card",
      productType: "gift_card",
    })
  })

  it("does not silently coerce unknown explicit template codes", () => {
    expect(
      resolveProductTemplate({
        code: "missing-template",
      })
    ).toBeUndefined()

    expect(
      resolveProductTemplate({
        metadata: {
          template_code: "missing-template",
        },
      })
    ).toBeUndefined()
  })

  it("falls back to default credential template when product type has no mapping", () => {
    expect(
      resolveProductTemplate({
        productType: "missing_type",
      })
    ).toMatchObject({
      code: "credential",
      productType: "credential",
    })
  })

  it("registers supplier-backed templates without changing core defaults", () => {
    ensureSupplierProductTemplatesRegistered()

    expect(getProductTemplate("reloadly-gift-card")).toMatchObject({
      code: "reloadly-gift-card",
      fulfillmentPolicyCode: "external-api",
      deliveryHandlerCode: "supplier-procurement",
      inventoryHandlerCode: "noop",
    })
    expect(getProductTemplate("g2a-key")).toMatchObject({
      code: "g2a-key",
      fulfillmentPolicyCode: "external-api",
    })
  })
})
