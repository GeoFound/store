import { Modules } from "@medusajs/framework/utils"
import type { BackendRuntimeContext } from "../platform/backend-context"
import { PLATFORM_HOOKS } from "../platform/hooks"
import { emitPlatformHook, registerPlatformHook } from "../platform/runtime"
import type { SupportedLocale } from "./localization"

export type NotificationSendInput = {
  to: string
  channel: string
  template: string
  data: Record<string, unknown>
  locale?: SupportedLocale
}

export type NotificationSendHookInput = NotificationSendInput & {
  scope: BackendRuntimeContext
}

let notificationHooksRegistered = false

export function ensureNotificationHooksRegistered() {
  if (notificationHooksRegistered) {
    return
  }

  registerPlatformHook<NotificationSendHookInput>({
    hook: PLATFORM_HOOKS.notificationSend,
    pluginId: "platform.notification",
    name: "platform.notification.send",
    version: "1.0.0",
    enabled: true,
    handler: async (input) => {
      const notificationModule = input.scope.resolve(
        Modules.NOTIFICATION
      ) as unknown as {
        createNotifications: (input: Record<string, unknown>) => Promise<unknown>
      }

      await notificationModule.createNotifications({
        to: input.to,
        channel: input.channel,
        template: input.template,
        data: input.data,
      })
    },
  })

  notificationHooksRegistered = true
}

export function resetNotificationHooksForTests() {
  notificationHooksRegistered = false
}

export async function emitNotification(
  scope: BackendRuntimeContext,
  input: NotificationSendInput
) {
  ensureNotificationHooksRegistered()

  await emitPlatformHook(PLATFORM_HOOKS.notificationSend, {
    scope,
    ...input,
  })
}

export async function sendGuestOrderRecoveryCode(
  container: BackendRuntimeContext,
  input: {
    email: string
    orderId: string
    code: string
    expiresAt?: string | null
    locale?: SupportedLocale
  }
) {
  await emitNotification(container, {
    to: input.email,
    channel: "email",
    template: "guest-order-recovery",
    data: {
      order_id: input.orderId,
      code: input.code,
      expires_at: input.expiresAt || null,
    },
    locale: input.locale,
  })
}
