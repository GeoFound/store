import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { ILockingModule } from "@medusajs/framework/types"
import { resolveSupportAuditService } from "../platform-adapters/services"

export default async function pruneAuditLogs(container: MedusaContainer) {
  const supportAudit = resolveSupportAuditService(container)
  const locking: ILockingModule = container.resolve(Modules.LOCKING)
  const logger = container.resolve("logger") as {
    info: (message: string, meta?: Record<string, unknown>) => void
  }

  const result = await locking.execute(
    "support-audit:prune-audit-logs",
    async () => supportAudit.pruneAuditLogs(),
    {
      timeout: 60,
    }
  )

  if (result.deleted_count) {
    logger.info("Pruned expired audit logs", result)
  }
}

export const config = {
  name: "prune-audit-logs",
  schedule: "17 3 * * *",
}
