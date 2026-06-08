import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveAiCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("ai-core")) {
    localizedError(req, res, 503, "ai.disabled")
    return
  }

  const aiCore = resolveAiCoreService(req.scope)

  res.json({
    policy: aiCore.getAdminControlPanelPolicy(),
  })
}
