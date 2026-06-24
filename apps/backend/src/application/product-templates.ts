export type StorefrontProductTemplateTranslation = {
  title?: string
  description?: string
}

export type StorefrontProductTemplateRecord = {
  code: string
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode: string
  deliveryHandlerCode: string
  inventoryHandlerCode?: string
  translations?: Partial<Record<string, StorefrontProductTemplateTranslation>>
}

export type StorefrontProductTemplate = Omit<
  StorefrontProductTemplateRecord,
  "translations"
>

export type StorefrontProductTemplateListInput = {
  locale?: string | null
}

export type StorefrontProductTemplateRepository = {
  listProductTemplates(): Promise<StorefrontProductTemplateRecord[]>
}

export type StorefrontProductTemplateApplication = {
  listProductTemplates(
    input?: StorefrontProductTemplateListInput
  ): Promise<StorefrontProductTemplate[]>
}

export function createStorefrontProductTemplateApplication(
  repository: StorefrontProductTemplateRepository
): StorefrontProductTemplateApplication {
  return {
    async listProductTemplates(input = {}) {
      const locale = normalizeLocale(input.locale)
      const templates = await repository.listProductTemplates()

      return templates.map((template) => localizeTemplate(template, locale))
    },
  }
}

function localizeTemplate(
  template: StorefrontProductTemplateRecord,
  locale?: string
) {
  const localized = locale ? template.translations?.[locale] : undefined
  const { translations: _translations, ...base } = template

  return {
    ...base,
    title: localized?.title || template.title,
    description: localized?.description || template.description,
  }
}

function normalizeLocale(value: StorefrontProductTemplateListInput["locale"]) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const locale = String(value).trim()

  if (!locale) {
    return undefined
  }

  return locale === "zh" ? "zh-CN" : locale
}
