import { Module } from "@medusajs/framework/utils"
import { ANALYTICS_CORE_MODULE } from "../../platform/analytics"
import AnalyticsCoreModuleService from "./service"

export { ANALYTICS_CORE_MODULE }

export default Module(ANALYTICS_CORE_MODULE, {
  service: AnalyticsCoreModuleService,
})
