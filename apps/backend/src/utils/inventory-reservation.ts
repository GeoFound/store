import type { MedusaContainer } from "@medusajs/framework/types"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  CREDENTIAL_INVENTORY_MODULE,
  type CredentialReservationService,
  type ReserveCredentialInput,
} from "../platform/credential-inventory"

export async function reserveCredentialsWithLock(
  container: MedusaContainer,
  input: ReserveCredentialInput
) {
  const locking: ILockingModule = container.resolve(Modules.LOCKING)
  const inventory = container.resolve<CredentialReservationService>(
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
