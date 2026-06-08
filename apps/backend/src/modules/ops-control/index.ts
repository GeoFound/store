import { Module } from "@medusajs/framework/utils"
import OpsControlModuleService from "./service"

export const OPS_CONTROL_MODULE = "opsControl"

export default Module(OPS_CONTROL_MODULE, {
  service: OpsControlModuleService,
})
