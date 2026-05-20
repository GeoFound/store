import { registerProductTemplate } from "../../platform/product-templates"

let registered = false

export function ensureSupplierProductTemplatesRegistered() {
  if (registered) {
    return
  }

  registerProductTemplate({
    code: "reloadly-gift-card",
    title: "Reloadly Gift Card",
    description: "Gift card fulfilled through Reloadly after payment.",
    productType: "api",
    fulfillmentPolicyCode: "external-api",
    deliveryHandlerCode: "supplier-procurement",
    inventoryHandlerCode: "noop",
  })

  registerProductTemplate({
    code: "reloadly-airtime",
    title: "Reloadly Airtime",
    description: "Mobile top-up fulfilled through Reloadly after payment.",
    productType: "api",
    fulfillmentPolicyCode: "external-api",
    deliveryHandlerCode: "supplier-procurement",
    inventoryHandlerCode: "noop",
  })

  registerProductTemplate({
    code: "g2a-key",
    title: "G2A Product Key",
    description: "Game, software, or gift-card key procured from G2A after payment.",
    productType: "api",
    fulfillmentPolicyCode: "external-api",
    deliveryHandlerCode: "supplier-procurement",
    inventoryHandlerCode: "noop",
  })

  registered = true
}

export function resetSupplierProductTemplatesForTests() {
  registered = false
}
