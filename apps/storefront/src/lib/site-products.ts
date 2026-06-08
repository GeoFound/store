import type { SiteProductDisplayConfig } from "./site-config"
import type { Product } from "./types"

export function applyProductDisplayConfig(
  products: Product[],
  displayConfig: SiteProductDisplayConfig[]
) {
  if (!displayConfig.length) {
    return products
  }

  const byHandle = new Map(
    displayConfig.map((entry) => [entry.handle, entry])
  )

  return products.map((product) =>
    applyProductDisplayEntry(product, byHandle.get(product.handle))
  )
}

export function applyProductDisplayEntry(
  product: Product,
  display?: SiteProductDisplayConfig
) {
  if (!display) {
    return product
  }

  const template = product.template
    ? {
        ...product.template,
        title: display.fulfillmentTitle || product.template.title,
        description:
          display.fulfillmentDescription || product.template.description,
        deliveryLabel: display.deliveryLabel || product.template.deliveryLabel,
      }
    : product.template

  return {
    ...product,
    title: display.title || product.title,
    description: display.description || product.description,
    thumbnail: display.hideThumbnail ? null : display.thumbnail || product.thumbnail,
    template,
    display: {
      ...product.display,
      hideVariantSelector: display.hideVariantSelector,
    },
  }
}
