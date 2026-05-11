import { Module } from "@medusajs/framework/utils"
import SupportAuditModuleService from "./service"

export const SUPPORT_AUDIT_MODULE = "supportAudit"

export default Module(SUPPORT_AUDIT_MODULE, {
  service: SupportAuditModuleService,
})
