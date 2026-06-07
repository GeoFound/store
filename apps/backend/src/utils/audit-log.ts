import type { BackendRuntimeContext } from "../platform/backend-context"
import { PLATFORM_HOOKS } from "../platform/hooks"
import { emitPlatformHook } from "../platform/runtime"
import { ensurePlatformIntegrationsRegistered } from "../platform-adapters/integrations"
import type { WriteAuditLogInput } from "../modules/support-audit/types"

export async function emitAuditLog(
  scope: BackendRuntimeContext,
  input: WriteAuditLogInput
) {
  ensurePlatformIntegrationsRegistered()

  await emitPlatformHook(PLATFORM_HOOKS.auditLog, {
    scope,
    ...input,
  })
}
