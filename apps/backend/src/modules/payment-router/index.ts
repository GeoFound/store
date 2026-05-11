import { Module } from "@medusajs/framework/utils"
import PaymentRouterModuleService from "./service"

export const PAYMENT_ROUTER_MODULE = "paymentRouter"

export default Module(PAYMENT_ROUTER_MODULE, {
  service: PaymentRouterModuleService,
})
