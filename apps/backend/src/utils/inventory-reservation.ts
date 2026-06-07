import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { ReserveCredentialInput } from "../modules/credential-inventory/types"
import { resolveCredentialInventoryService } from "../platform-adapters/services"

export async function reserveCredentialsWithLock(
  container: MedusaContainer,
  input: ReserveCredentialInput
) {
  const locking: ILockingModule = container.resolve(Modules.LOCKING)
  const inventory = resolveCredentialInventoryService(container)

  return locking.execute(
    `credential-variant:${input.productVariantId}`,
    async () => inventory.reserveCredentials(input),
    {
      timeout: 30,
    }
  )
}
