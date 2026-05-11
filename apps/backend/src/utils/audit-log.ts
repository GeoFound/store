import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_HOOKS } from "../platform/hooks"
import { emitPlatformHook } from "../platform/runtime"
import { ensurePlatformIntegrationsRegistered } from "../platform/integrations"
import type { WriteAuditLogInput } from "../modules/support-audit/types"

export async function emitAuditLog(
  scope: MedusaContainer,
  input: WriteAuditLogInput
) {
  ensurePlatformIntegrationsRegistered()

  await emitPlatformHook(PLATFORM_HOOKS.auditLog, {
    scope,
    ...input,
  })
}
