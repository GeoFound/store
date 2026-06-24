import {
  createStorefrontProductTemplateApplication,
  type StorefrontProductTemplateRepository,
} from "../product-templates"

describe("storefront product template application", () => {
  it("lists product templates through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.listProductTemplates.mockResolvedValue([
      {
        code: "credential",
        title: "Credential",
        description: "Single secret delivered after payment.",
        productType: "credential",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "credential",
        inventoryHandlerCode: "credential-inventory",
      },
    ])
    const productTemplates =
      createStorefrontProductTemplateApplication(repository)

    await expect(productTemplates.listProductTemplates()).resolves.toEqual([
      {
        code: "credential",
        title: "Credential",
        description: "Single secret delivered after payment.",
        productType: "credential",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "credential",
        inventoryHandlerCode: "credential-inventory",
      },
    ])

    expect(repository.listProductTemplates).toHaveBeenCalledTimes(1)
  })

  it("localizes public template titles and descriptions", async () => {
    const repository = createRepository()
    repository.listProductTemplates.mockResolvedValue([
      {
        code: "credential",
        title: "Credential",
        description: "Single secret delivered after payment.",
        productType: "credential",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "credential",
        translations: {
          "zh-CN": {
            title: "凭证",
            description: "支付后交付的单个密钥、卡密或凭证字符串。",
          },
        },
      },
    ])
    const productTemplates =
      createStorefrontProductTemplateApplication(repository)

    await expect(
      productTemplates.listProductTemplates({ locale: "zh-CN" })
    ).resolves.toEqual([
      {
        code: "credential",
        title: "凭证",
        description: "支付后交付的单个密钥、卡密或凭证字符串。",
        productType: "credential",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "credential",
      },
    ])
  })

  it("normalizes zh locale aliases and removes adapter translation fields", async () => {
    const repository = createRepository()
    repository.listProductTemplates.mockResolvedValue([
      {
        code: "manual",
        title: "Manual Fulfillment",
        description: "Human-assisted activation or service fulfillment.",
        productType: "manual",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "manual",
        translations: {
          "zh-CN": {
            title: "人工履约",
            description: "需要人工协助完成的激活或服务履约。",
          },
        },
      },
    ])
    const productTemplates =
      createStorefrontProductTemplateApplication(repository)

    await expect(
      productTemplates.listProductTemplates({ locale: " zh " })
    ).resolves.toEqual([
      {
        code: "manual",
        title: "人工履约",
        description: "需要人工协助完成的激活或服务履约。",
        productType: "manual",
        fulfillmentPolicyCode: "default",
        deliveryHandlerCode: "manual",
      },
    ])
  })
})

function createRepository() {
  return {
    listProductTemplates: jest.fn(),
  } satisfies jest.Mocked<StorefrontProductTemplateRepository>
}
