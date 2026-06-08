import "./integrations"
import type { BackendRuntimeContext } from "../platform/backend-context"
import { AI_CORE_MODULE } from "../modules/ai-core"
import type AiCoreModuleService from "../modules/ai-core/service"
import { ANALYTICS_CORE_MODULE } from "../modules/analytics-core"
import type AnalyticsCoreModuleService from "../modules/analytics-core/service"
import { CONTENT_CORE_MODULE } from "../modules/content-core"
import type ContentCoreModuleService from "../modules/content-core/service"
import { CREDENTIAL_INVENTORY_MODULE } from "../modules/credential-inventory"
import type CredentialInventoryModuleService from "../modules/credential-inventory/service"
import { DIGITAL_DELIVERY_MODULE } from "../modules/digital-delivery"
import type DigitalDeliveryModuleService from "../modules/digital-delivery/service"
import { GUEST_ORDER_ACCESS_MODULE } from "../modules/guest-order-access"
import type GuestOrderAccessModuleService from "../modules/guest-order-access/service"
import { MARKETING_ENGINE_MODULE } from "../modules/marketing-engine"
import type MarketingEngineModuleService from "../modules/marketing-engine/service"
import { OPS_CONTROL_MODULE } from "../modules/ops-control"
import type OpsControlModuleService from "../modules/ops-control/service"
import { PAYMENT_ROUTER_MODULE } from "../modules/payment-router"
import type PaymentRouterModuleService from "../modules/payment-router/service"
import { SUPPORT_AUDIT_MODULE } from "../modules/support-audit"
import type SupportAuditModuleService from "../modules/support-audit/service"
import { SUPPLIER_PROCUREMENT_MODULE } from "../modules/supplier-procurement"
import type SupplierProcurementModuleService from "../modules/supplier-procurement/service"

export function resolveAnalyticsCoreService(scope: BackendRuntimeContext) {
  return scope.resolve(ANALYTICS_CORE_MODULE) as AnalyticsCoreModuleService
}

export function resolveAiCoreService(scope: BackendRuntimeContext) {
  return scope.resolve(AI_CORE_MODULE) as AiCoreModuleService
}

export function resolveContentCoreService(scope: BackendRuntimeContext) {
  return scope.resolve(CONTENT_CORE_MODULE) as ContentCoreModuleService
}

export function resolveCredentialInventoryService(scope: BackendRuntimeContext) {
  return scope.resolve(
    CREDENTIAL_INVENTORY_MODULE
  ) as CredentialInventoryModuleService
}

export function resolveDigitalDeliveryService(scope: BackendRuntimeContext) {
  return scope.resolve(DIGITAL_DELIVERY_MODULE) as DigitalDeliveryModuleService
}

export function resolveGuestOrderAccessService(scope: BackendRuntimeContext) {
  return scope.resolve(GUEST_ORDER_ACCESS_MODULE) as GuestOrderAccessModuleService
}

export function resolveMarketingEngineService(scope: BackendRuntimeContext) {
  return scope.resolve(MARKETING_ENGINE_MODULE) as MarketingEngineModuleService
}

export function resolveOpsControlService(scope: BackendRuntimeContext) {
  return scope.resolve(OPS_CONTROL_MODULE) as OpsControlModuleService
}

export function resolvePaymentRouterService(scope: BackendRuntimeContext) {
  return scope.resolve(PAYMENT_ROUTER_MODULE) as PaymentRouterModuleService
}

export function resolveSupportAuditService(scope: BackendRuntimeContext) {
  return scope.resolve(SUPPORT_AUDIT_MODULE) as SupportAuditModuleService
}

export function resolveSupplierProcurementService(scope: BackendRuntimeContext) {
  return scope.resolve(
    SUPPLIER_PROCUREMENT_MODULE
  ) as SupplierProcurementModuleService
}
