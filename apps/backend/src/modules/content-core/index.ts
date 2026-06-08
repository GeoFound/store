import { Module } from "@medusajs/framework/utils"
import ContentCoreModuleService from "./service"

export const CONTENT_CORE_MODULE = "contentCore"

export default Module(CONTENT_CORE_MODULE, {
  service: ContentCoreModuleService,
})

export * from "./plugin"
export * from "./types"
