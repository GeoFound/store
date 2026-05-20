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
    translations: {
      "zh-CN": {
        title: "Reloadly 礼品卡",
        description: "支付后通过 Reloadly 履约的礼品卡。",
      },
    },
  })

  registerProductTemplate({
    code: "reloadly-airtime",
    title: "Reloadly Airtime",
    description: "Mobile top-up fulfilled through Reloadly after payment.",
    productType: "api",
    fulfillmentPolicyCode: "external-api",
    deliveryHandlerCode: "supplier-procurement",
    inventoryHandlerCode: "noop",
    translations: {
      "zh-CN": {
        title: "Reloadly 话费",
        description: "支付后通过 Reloadly 履约的手机充值。",
      },
    },
  })

  registerProductTemplate({
    code: "g2a-key",
    title: "G2A Product Key",
    description: "Game, software, or gift-card key procured from G2A after payment.",
    productType: "api",
    fulfillmentPolicyCode: "external-api",
    deliveryHandlerCode: "supplier-procurement",
    inventoryHandlerCode: "noop",
    translations: {
      "zh-CN": {
        title: "G2A 产品密钥",
        description: "支付后从 G2A 采购的游戏、软件或礼品卡密钥。",
      },
    },
  })

  registered = true
}

export function resetSupplierProductTemplatesForTests() {
  registered = false
}
