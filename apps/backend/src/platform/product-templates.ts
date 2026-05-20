import type { SupportedLocale } from "../utils/localization"

export type ProductTemplateCode = string

export type ProductTemplate = {
  code: ProductTemplateCode
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
  translations?: Partial<
    Record<SupportedLocale, { title: string; description: string }>
  >
}

const templates = new Map<string, ProductTemplate>()

const defaultTemplates: ProductTemplate[] = [
  {
    code: "credential",
    title: "Credential",
    description: "Single secret, card key, or credential string delivered after payment.",
    productType: "credential",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    translations: {
      "zh-CN": {
        title: "凭证",
        description: "支付后交付的单个密钥、卡密或凭证字符串。",
      },
    },
  },
  {
    code: "account",
    title: "Account",
    description: "Username and password style account handoff.",
    productType: "account",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    translations: {
      "zh-CN": {
        title: "账号",
        description: "用户名和密码形式的账号交付。",
      },
    },
  },
  {
    code: "license",
    title: "License Key",
    description: "License or activation key delivered from inventory.",
    productType: "license",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    translations: {
      "zh-CN": {
        title: "许可证密钥",
        description: "从库存交付的许可或激活密钥。",
      },
    },
  },
  {
    code: "code",
    title: "Redeem Code",
    description: "Redeemable code delivered after payment.",
    productType: "code",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    translations: {
      "zh-CN": {
        title: "兑换码",
        description: "支付后交付的可兑换代码。",
      },
    },
  },
  {
    code: "file",
    title: "File Download",
    description: "File delivery or download access after purchase.",
    productType: "file",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    translations: {
      "zh-CN": {
        title: "文件下载",
        description: "购买后提供文件交付或下载权限。",
      },
    },
  },
  {
    code: "manual",
    title: "Manual Fulfillment",
    description: "Human-assisted activation or service fulfillment.",
    productType: "manual",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    translations: {
      "zh-CN": {
        title: "人工履约",
        description: "需要人工协助完成的激活或服务履约。",
      },
    },
  },
  {
    code: "api",
    title: "API Provisioned",
    description: "External API or system-provisioned digital product.",
    productType: "api",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    translations: {
      "zh-CN": {
        title: "API 配置型",
        description: "由外部 API 或系统配置的数字产品。",
      },
    },
  },
]

let defaultsRegistered = false

export function registerProductTemplate(template: ProductTemplate) {
  templates.set(template.code, template)
}

export function ensureDefaultProductTemplatesRegistered() {
  if (defaultsRegistered) {
    return
  }

  for (const template of defaultTemplates) {
    registerProductTemplate(template)
  }

  defaultsRegistered = true
}

export function listProductTemplates() {
  ensureDefaultProductTemplatesRegistered()
  return Array.from(templates.values())
}

export function listLocalizedProductTemplates(locale?: string | null) {
  return listProductTemplates().map((template) =>
    localizeProductTemplate(template, locale)
  )
}

export function getProductTemplate(code?: string | null) {
  ensureDefaultProductTemplatesRegistered()

  if (!code) {
    return undefined
  }

  return templates.get(code)
}

export function getLocalizedProductTemplate(
  code?: string | null,
  locale?: string | null
) {
  const template = getProductTemplate(code)

  if (!template) {
    return undefined
  }

  return localizeProductTemplate(template, locale)
}

export function resolveProductTemplate(input?: {
  code?: string | null
  productType?: string | null
  metadata?: Record<string, unknown> | null
}) {
  ensureDefaultProductTemplatesRegistered()

  const metadata = input?.metadata || {}
  const explicitCode =
    toOptionalString(input?.code) ||
    toOptionalString(metadata.template_code) ||
    toOptionalString(metadata.templateCode) ||
    toOptionalString(metadata.product_template) ||
    toOptionalString(metadata.productTemplate)

  if (explicitCode) {
    return getProductTemplate(explicitCode)
  }

  const productType =
    toOptionalString(input?.productType) ||
    toOptionalString(metadata.product_type) ||
    toOptionalString(metadata.productType)

  if (!productType) {
    return getProductTemplate("credential")
  }

  return (
    listProductTemplates().find((template) => template.productType === productType) ||
    getProductTemplate("credential")
  )
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

export function localizeProductTemplate(
  template: ProductTemplate,
  locale?: string | null
) {
  const resolvedLocale =
    locale === "zh" ? "zh-CN" : (locale as SupportedLocale | undefined)
  const localized = resolvedLocale
    ? template.translations?.[resolvedLocale]
    : undefined
  const { translations: _translations, ...base } = template

  return {
    ...base,
    title: localized?.title || template.title,
    description: localized?.description || template.description,
  }
}

export function resetProductTemplatesForTests() {
  templates.clear()
  defaultsRegistered = false
}
