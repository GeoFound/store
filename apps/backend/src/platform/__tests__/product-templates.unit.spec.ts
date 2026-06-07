import {
  getProductTemplate,
  getLocalizedProductTemplate,
  listProductTemplates,
  listLocalizedProductTemplates,
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

  it("returns localized product template content for Chinese requests", () => {
    const templates = listLocalizedProductTemplates("zh-CN")
    const credential = templates.find((template) => template.code === "credential")

    expect(credential).toMatchObject({
      title: "凭证",
      description: "支付后交付的单个密钥、卡密或凭证字符串。",
    })
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
})
