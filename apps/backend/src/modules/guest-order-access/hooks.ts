import { PLATFORM_HOOKS } from "../../platform/hooks"
import { registerPlatformHook } from "../../platform/runtime"
import type { OrderAccessRecoveryCodeCreatedEvent } from "../../platform/events"
import { sendGuestOrderRecoveryCode } from "../../utils/notification"
import { resolveLocaleFromValue } from "../../utils/localization"

let hooksRegistered = false

export function ensureGuestOrderAccessHooksRegistered() {
  if (hooksRegistered) {
    return
  }

  registerPlatformHook<OrderAccessRecoveryCodeCreatedEvent>({
    hook: PLATFORM_HOOKS.orderAccessRecoveryCodeCreated,
    pluginId: "guest-order-access",
    name: "guest-order-access.send-recovery-code",
    version: "1.0.0",
    enabled: true,
    handler: async (event) => {
      await sendGuestOrderRecoveryCode(event.scope, {
        email: event.payload.customerEmail,
        orderId: event.payload.orderId,
        code: event.payload.code,
        expiresAt: event.payload.expiresAt || null,
        locale: resolveLocaleFromValue(event.payload.locale) || undefined,
      })
    },
  })

  hooksRegistered = true
}

export function resetGuestOrderAccessHooksForTests() {
  hooksRegistered = false
}
