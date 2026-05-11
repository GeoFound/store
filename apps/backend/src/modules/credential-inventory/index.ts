import { Module } from "@medusajs/framework/utils"
import CredentialInventoryModuleService from "./service"

export const CREDENTIAL_INVENTORY_MODULE = "credentialInventory"

export default Module(CREDENTIAL_INVENTORY_MODULE, {
  service: CredentialInventoryModuleService,
})
