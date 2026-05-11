export type ProductTemplateCode = string

export type ProductTemplate = {
  code: ProductTemplateCode
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
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
  },
  {
    code: "account",
    title: "Account",
    description: "Username and password style account handoff.",
    productType: "account",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
  },
  {
    code: "license",
    title: "License Key",
    description: "License or activation key delivered from inventory.",
    productType: "license",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
  },
  {
    code: "code",
    title: "Redeem Code",
    description: "Redeemable code delivered after payment.",
    productType: "code",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
  },
  {
    code: "file",
    title: "File Download",
    description: "File delivery or download access after purchase.",
    productType: "file",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
  },
  {
    code: "manual",
    title: "Manual Fulfillment",
    description: "Human-assisted activation or service fulfillment.",
    productType: "manual",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
  },
  {
    code: "api",
    title: "API Provisioned",
    description: "External API or system-provisioned digital product.",
    productType: "api",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
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

export function getProductTemplate(code?: string | null) {
  ensureDefaultProductTemplatesRegistered()

  if (!code) {
    return undefined
  }

  return templates.get(code)
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

export function resetProductTemplatesForTests() {
  templates.clear()
  defaultsRegistered = false
}
