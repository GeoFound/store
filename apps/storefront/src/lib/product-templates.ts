export type ProductTemplateCode = string

export type ProductTemplate = {
  code: ProductTemplateCode
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
  deliveryLabel: string
}

export type ProductTemplateDefinition = Omit<ProductTemplate, "deliveryLabel"> & {
  deliveryLabel?: string
}

const defaultTemplates: ProductTemplateDefinition[] = [
  {
    code: "credential",
    title: "Credential",
    description: "Single-use secret, card key, or access credential.",
    productType: "credential",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    deliveryLabel: "Key delivery",
  },
  {
    code: "account",
    title: "Account",
    description: "Username and password account handoff.",
    productType: "account",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    deliveryLabel: "Account delivery",
  },
  {
    code: "license",
    title: "License Key",
    description: "License or activation key delivery.",
    productType: "license",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    deliveryLabel: "License delivery",
  },
  {
    code: "code",
    title: "Redeem Code",
    description: "Redeemable code for external platforms.",
    productType: "code",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "credential",
    inventoryHandlerCode: "credential-inventory",
    deliveryLabel: "Code delivery",
  },
  {
    code: "file",
    title: "File Download",
    description: "Downloadable file or asset access.",
    productType: "file",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    deliveryLabel: "File access",
  },
  {
    code: "manual",
    title: "Manual Fulfillment",
    description: "Human-assisted or delayed service activation.",
    productType: "manual",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    deliveryLabel: "Manual fulfillment",
  },
  {
    code: "api",
    title: "API Provisioned",
    description: "Provisioned through an external system or API.",
    productType: "api",
    fulfillmentPolicyCode: "default",
    deliveryHandlerCode: "manual",
    inventoryHandlerCode: "noop",
    deliveryLabel: "Provisioned delivery",
  },
]

export function resolveProductTemplate(
  input?: {
    metadata?: Record<string, unknown> | null
    productType?: string | null
  },
  templates?: ProductTemplateDefinition[]
) {
  const metadata = input?.metadata || {}
  const availableTemplates = normalizeTemplateDefinitions(templates)
  const credentialTemplate =
    availableTemplates.find((template) => template.code === "credential") ||
    defaultTemplates[0]

  const explicitCode =
    toOptionalString(metadata.template_code) ||
    toOptionalString(metadata.templateCode) ||
    toOptionalString(metadata.product_template) ||
    toOptionalString(metadata.productTemplate)

  if (explicitCode) {
    return availableTemplates.find((template) => template.code === explicitCode)
  }

  const productType =
    toOptionalString(input?.productType) ||
    toOptionalString(metadata.product_type) ||
    toOptionalString(metadata.productType)

  if (!productType) {
    return toProductTemplate(credentialTemplate)
  }

  return (
    availableTemplates.find((template) => template.productType === productType) ||
    toProductTemplate(credentialTemplate)
  )
}

function normalizeTemplateDefinitions(templates?: ProductTemplateDefinition[]) {
  const source = templates?.length ? templates : defaultTemplates
  const seen = new Set<string>()
  const normalized: ProductTemplate[] = []

  for (const template of source) {
    if (!template?.code || seen.has(template.code)) {
      continue
    }

    seen.add(template.code)
    normalized.push(toProductTemplate(template))
  }

  const hasCredential = normalized.some((template) => template.code === "credential")
  if (!hasCredential) {
    normalized.push(toProductTemplate(defaultTemplates[0]))
  }

  return normalized
}

function toProductTemplate(template: ProductTemplateDefinition): ProductTemplate {
  return {
    code: template.code,
    title: template.title,
    description: template.description,
    productType: template.productType,
    fulfillmentPolicyCode: template.fulfillmentPolicyCode,
    deliveryHandlerCode: template.deliveryHandlerCode,
    inventoryHandlerCode: template.inventoryHandlerCode,
    deliveryLabel:
      template.deliveryLabel ||
      defaultDeliveryLabelFor(template.code, template.title),
  }
}

function defaultDeliveryLabelFor(code: string, title: string) {
  const normalized = code.trim().toLowerCase()

  if (normalized === "credential") {
    return "Key delivery"
  }
  if (normalized === "account") {
    return "Account delivery"
  }
  if (normalized === "license") {
    return "License delivery"
  }
  if (normalized === "code") {
    return "Code delivery"
  }
  if (normalized === "file") {
    return "File access"
  }
  if (normalized === "api") {
    return "Provisioned delivery"
  }
  if (normalized === "manual") {
    return "Manual fulfillment"
  }

  return `${title} delivery`
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
