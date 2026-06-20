import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { listAITaskRunsForDashboard } from "../../../../platform-adapters/ai-runs"
import { resolveAiCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("ai-core")) {
    localizedError(req, res, 503, "ai.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as { site_id?: string }
  const aiCore = resolveAiCoreService(req.scope)
  const taskRuns = await listAITaskRunsForDashboard(req.scope, {
    siteId: query.site_id,
  })

  res.json(
    aiCore.getDashboardSnapshot({
      siteId: query.site_id,
      taskRuns,
    })
  )
}
