import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import CredentialInventoryModuleService from "../modules/credential-inventory/service"
import { CREDENTIAL_INVENTORY_MODULE } from "../modules/credential-inventory"
import type { ReserveCredentialInput } from "../modules/credential-inventory/types"

export async function reserveCredentialsWithLock(
  container: MedusaContainer,
  input: ReserveCredentialInput
) {
  const locking: ILockingModule = container.resolve(Modules.LOCKING)
  const inventory: CredentialInventoryModuleService = container.resolve(
    CREDENTIAL_INVENTORY_MODULE
  )

  return locking.execute(
    `credential-variant:${input.productVariantId}`,
    async () => inventory.reserveCredentials(input),
    {
      timeout: 30,
    }
  )
}
