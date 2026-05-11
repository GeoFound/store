export type PlatformHookName = string

export const PLATFORM_HOOKS = {
  auditLog: "audit.log",
  notificationSend: "notification.send",
  orderAccessRecoveryCodeCreated: "order_access.recovery_code_created",
  orderAccessTokenIssued: "order_access.token_issued",
  paymentAttemptReserved: "payment_attempt.reserved",
  paymentAttemptFinalized: "payment_attempt.finalized",
  deliveryCreated: "delivery.created",
} as const

export type PlatformHookHandler<T = unknown> = (input: T) => Promise<void> | void

export type RegisteredHook<T = unknown> = {
  hook: PlatformHookName
  pluginId: string
  name: string
  version: string
  enabled?: boolean
  handler: PlatformHookHandler<T>
}

export class PlatformHookRegistry {
  private hooks = new Map<PlatformHookName, Map<string, RegisteredHook<unknown>>>()

  constructor(
    private readonly isPluginEnabled: (pluginId: string) => boolean = () => true,
    private readonly isHookEnabled: (hookName: string) => boolean = () => true
  ) {}

  registerHook<T>(hook: RegisteredHook<T>) {
    const handlers = this.hooks.get(hook.hook) ?? new Map()
    handlers.set(hook.name, {
      ...hook,
      handler: hook.handler,
    })
    this.hooks.set(hook.hook, handlers)
  }

  listHooks(hook: PlatformHookName) {
    return Array.from(this.hooks.get(hook)?.values() || [])
  }

  async emitHook<T>(hook: PlatformHookName, input: T) {
    for (const handler of this.listHooks(hook)) {
      if (handler.enabled === false) {
        continue
      }

      if (!this.isPluginEnabled(handler.pluginId)) {
        continue
      }

      if (!this.isHookEnabled(handler.name)) {
        continue
      }

      await handler.handler(input)
    }
  }
}

export function createPlatformHookRegistry(input?: {
  isPluginEnabled?: (pluginId: string) => boolean
  isHookEnabled?: (hookName: string) => boolean
}) {
  return new PlatformHookRegistry(input?.isPluginEnabled, input?.isHookEnabled)
}
