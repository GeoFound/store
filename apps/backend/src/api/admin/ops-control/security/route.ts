import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveOpsControlService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("ops-control")) {
    localizedError(req, res, 503, "ops.disabled")
    return
  }

  const opsControl = resolveOpsControlService(req.scope)

  res.json({
    security: opsControl.getSecuritySnapshot(),
  })
}
