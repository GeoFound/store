import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../platform-adapters/services"
import { localizedError } from "../../../../utils/localized-response"

type CreateContentAssetBody = {
  site_id?: string | null
  entry_id?: string | null
  revision_id?: string | null
  asset_type?: "cover_image" | "inline_image" | "audio" | "attachment" | "transcript" | "source"
  storage_provider?: "local" | "s3" | "r2" | "external"
  storage_provider_code?: string | null
  bucket?: string | null
  object_key?: string | null
  public_url?: string | null
  mime_type?: string | null
  byte_size?: number | null
  checksum?: string | null
  width?: number | null
  height?: number | null
  duration_seconds?: number | null
  alt_text?: string | null
  caption?: string | null
  metadata?: Record<string, unknown> | null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    site_id?: string
    entry_id?: string
    asset_type?: string
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const assets = await content.listContentAssets(
    {
      ...(query.site_id ? { site_id: query.site_id } : {}),
      ...(query.entry_id ? { entry_id: query.entry_id } : {}),
      ...(query.asset_type ? { asset_type: query.asset_type } : {}),
    },
    {
      take: normalizeLimit(query.limit, 100),
      order: {
        created_at: "DESC",
      },
    }
  )

  res.json({ assets })
}

export const POST = async (
  req: MedusaRequest<CreateContentAssetBody>,
  res: MedusaResponse
) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const body = (req.validatedBody || req.body) as CreateContentAssetBody
  const content = resolveContentCoreService(req.scope)
  const asset = await content.createAssetSafe({
    siteId: body.site_id,
    entryId: body.entry_id,
    revisionId: body.revision_id,
    assetType: body.asset_type,
    storageProvider: body.storage_provider,
    storageProviderCode: body.storage_provider_code,
    bucket: body.bucket,
    objectKey: body.object_key,
    publicUrl: body.public_url,
    mimeType: body.mime_type,
    byteSize: body.byte_size,
    checksum: body.checksum,
    width: body.width,
    height: body.height,
    durationSeconds: body.duration_seconds,
    altText: body.alt_text,
    caption: body.caption,
    metadata: body.metadata,
  })

  res.status(201).json({ asset })
}

function normalizeLimit(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.min(Math.floor(numberValue), 200)
    : fallback
}
