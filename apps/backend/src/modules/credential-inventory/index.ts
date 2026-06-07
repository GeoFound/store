import { Module } from "@medusajs/framework/utils"
import { CREDENTIAL_INVENTORY_MODULE } from "../../platform/credential-inventory"
import CredentialInventoryModuleService from "./service"

export { CREDENTIAL_INVENTORY_MODULE }

export default Module(CREDENTIAL_INVENTORY_MODULE, {
  service: CredentialInventoryModuleService,
})
