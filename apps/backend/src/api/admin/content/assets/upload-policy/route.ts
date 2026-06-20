import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

type ContentUploadPolicyBody = {
  site_id?: string | null
  entry_id?: string | null
  asset_type?: "cover_image" | "inline_image" | "audio" | "attachment" | "transcript" | "source"
  storage_provider_code?: string | null
  filename?: string | null
  mime_type?: string | null
  expires_in_seconds?: number | null
}

export const POST = async (
  req: MedusaRequest<ContentUploadPolicyBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as ContentUploadPolicyBody
  const content = resolveContentCoreService(req.scope)
  const upload = content.createUploadPolicySafe({
    storageProviderCode: body.storage_provider_code,
    assetType: body.asset_type,
    entryId: body.entry_id,
    filename: body.filename,
    mimeType: body.mime_type,
    siteId: body.site_id,
    expiresInSeconds: body.expires_in_seconds,
  })

  res.json({
    upload,
  })
}
