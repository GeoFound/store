import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PLATFORM_HOOKS } from "../platform/hooks"
import { emitPlatformHook, registerPlatformHook } from "../platform/runtime"

export type NotificationSendInput = {
  to: string
  channel: string
  template: string
  data: Record<string, unknown>
}

export type NotificationSendHookInput = NotificationSendInput & {
  scope: MedusaContainer
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
  scope: MedusaContainer,
  input: NotificationSendInput
) {
  ensureNotificationHooksRegistered()

  await emitPlatformHook(PLATFORM_HOOKS.notificationSend, {
    scope,
    ...input,
  })
}

export async function sendGuestOrderRecoveryCode(
  container: MedusaContainer,
  input: {
    email: string
    orderId: string
    code: string
    expiresAt?: string | null
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
  })
}
