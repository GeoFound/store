import { Module } from "@medusajs/framework/utils"
import MarketingEngineModuleService from "./service"

export const MARKETING_ENGINE_MODULE = "marketingEngine"

export default Module(MARKETING_ENGINE_MODULE, {
  service: MarketingEngineModuleService,
})
