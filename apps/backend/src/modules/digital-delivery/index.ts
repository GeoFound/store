import { Module } from "@medusajs/framework/utils"
import DigitalDeliveryModuleService from "./service"

export const DIGITAL_DELIVERY_MODULE = "digitalDelivery"

export default Module(DIGITAL_DELIVERY_MODULE, {
  service: DigitalDeliveryModuleService,
})
