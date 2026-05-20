import {
  ensurePlatformObservabilityHooksRegistered,
  resetPlatformObservabilityForTests,
} from "./observability"
import {
  ensureSupportAuditHooksRegistered,
  resetSupportAuditHooksForTests,
} from "../modules/support-audit/hooks"
import {
  ensureGuestOrderAccessHooksRegistered,
  resetGuestOrderAccessHooksForTests,
} from "../modules/guest-order-access/hooks"
import {
  ensureMarketingHooksRegistered,
  resetMarketingHooksForTests,
} from "../modules/marketing-engine/hooks"
import {
  ensureAnalyticsGa4HooksRegistered,
  resetAnalyticsGa4HooksForTests,
} from "../modules/analytics-ga4/hooks"
import { resetAnalyticsGa4DestinationForTests } from "../modules/analytics-ga4/destination"
import { resetNotificationHooksForTests } from "../utils/notification"
import {
  ensureNotificationResendHooksRegistered,
  resetNotificationResendHooksForTests,
} from "../modules/notification-resend/hooks"
import {
  ensureSupplierProductTemplatesRegistered,
  resetSupplierProductTemplatesForTests,
} from "../modules/supplier-procurement/templates"

let integrationsRegistered = false

export function ensurePlatformIntegrationsRegistered() {
  if (integrationsRegistered) {
    return
  }

  integrationsRegistered = true

  try {
    ensurePlatformObservabilityHooksRegistered()
    ensureSupportAuditHooksRegistered()
    ensureGuestOrderAccessHooksRegistered()
    ensureMarketingHooksRegistered()
    ensureAnalyticsGa4HooksRegistered()
    ensureNotificationResendHooksRegistered()
    ensureSupplierProductTemplatesRegistered()
  } catch (error) {
    integrationsRegistered = false
    throw error
  }
}

export function resetPlatformIntegrationsForTests() {
  integrationsRegistered = false
  resetPlatformObservabilityForTests()
  resetSupportAuditHooksForTests()
  resetGuestOrderAccessHooksForTests()
  resetMarketingHooksForTests()
  resetAnalyticsGa4HooksForTests()
  resetAnalyticsGa4DestinationForTests()
  resetNotificationHooksForTests()
  resetNotificationResendHooksForTests()
  resetSupplierProductTemplatesForTests()
}
