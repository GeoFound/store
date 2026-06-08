import { Module } from "@medusajs/framework/utils"
import AiCoreModuleService from "./service"

export const AI_CORE_MODULE = "aiCore"

export default Module(AI_CORE_MODULE, {
  service: AiCoreModuleService,
})

export * from "./config"
export * from "./plugin"
export * from "./types"
