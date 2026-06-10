import type { BackendRuntimeContext } from "../platform/backend-context"
import { hasSupplierMetadataPath } from "../platform/checkout-policy"
import { resolveSupplierProcurementService } from "./services"

export {
  getCheckoutPolicy,
  hasSupplierMetadataPath,
  isOutOfStockReservationError,
  isSupplierAutoProcurementEnabled,
  parseOutOfStockPolicy,
} from "../platform/checkout-policy"

export async function hasSupplierBackorderPath(input: {
  scope: BackendRuntimeContext
  productVariantId: string
  metadata?: Record<string, unknown> | null
}) {
  if (hasSupplierMetadataPath(input.metadata)) {
    return true
  }

  const procurement = resolveSupplierProcurementService(input.scope)
  const mappings = await procurement.listMappingsSafe({
    productVariantId: input.productVariantId,
    enabled: true,
    limit: 1,
  })

  return mappings.length > 0
}
