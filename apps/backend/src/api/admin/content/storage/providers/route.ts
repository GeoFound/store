import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const content = resolveContentCoreService(req.scope)

  res.json(content.listStorageProvidersSafe())
}
