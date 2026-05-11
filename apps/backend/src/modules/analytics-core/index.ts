import { Module } from "@medusajs/framework/utils"
import AnalyticsCoreModuleService from "./service"

export const ANALYTICS_CORE_MODULE = "analyticsCore"

export default Module(ANALYTICS_CORE_MODULE, {
  service: AnalyticsCoreModuleService,
})
