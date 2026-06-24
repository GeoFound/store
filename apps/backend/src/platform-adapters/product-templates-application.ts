import {
  createStorefrontProductTemplateApplication,
  type StorefrontProductTemplateRepository,
} from "../application/product-templates"
import { listProductTemplates } from "../platform/product-templates"

export function resolveStorefrontProductTemplateApplication() {
  const repository: StorefrontProductTemplateRepository = {
    async listProductTemplates() {
      return listProductTemplates()
    },
  }

  return createStorefrontProductTemplateApplication(repository)
}
