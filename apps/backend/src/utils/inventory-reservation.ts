import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { ReserveCredentialInput } from "../platform/credential-inventory"
import { resolveCredentialInventoryService } from "../platform/services"

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
