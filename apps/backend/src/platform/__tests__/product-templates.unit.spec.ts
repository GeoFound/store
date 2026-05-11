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

  it("falls back to default credential template when no match exists", () => {
    expect(
      resolveProductTemplate({
        code: "missing-template",
      })
    ).toMatchObject({
      code: "credential",
      productType: "credential",
    })

    expect(
      resolveProductTemplate({
        productType: "missing_type",
      })
    ).toMatchObject({
      code: "credential",
      productType: "credential",
    })
  })
})
