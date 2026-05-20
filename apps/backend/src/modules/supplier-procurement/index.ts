import SupplierProcurementModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const SUPPLIER_PROCUREMENT_MODULE = "supplier-procurement"

export default Module(SUPPLIER_PROCUREMENT_MODULE, {
  service: SupplierProcurementModuleService,
})

export * from "./plugin"
export * from "./types"
