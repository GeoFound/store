import type { ProductFulfillmentPolicy } from "../../platform/delivery"

export const externalApiFulfillmentPolicy: ProductFulfillmentPolicy = {
  code: "external-api",

  resolvePlan(input) {
    const metadata = normalizeRecord(input.metadata)
    const deliveryHandlerCode =
      toOptionalString(metadata.delivery_handler_code) ||
      toOptionalString(metadata.deliveryHandlerCode) ||
      "supplier-procurement"

    return {
      code: "external-api:supplier-procurement",
      deliveryHandlerCode,
      inventoryHandlerCode: "noop",
      inventoryMode: "none",
    }
  },
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
