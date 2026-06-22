import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPlatformPluginEnabled } from "../../../../../platform/runtime"
import { resolveContentCoreService } from "../../../../../platform-adapters/services"
import { localizedError } from "../../../../../utils/localized-response"

function isoDate(value: number) {
  return new Date(value).toISOString().slice(0, 10)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!isPlatformPluginEnabled("content-core")) {
    localizedError(req, res, 503, "content.disabled")
    return
  }

  const query = (req.validatedQuery || req.query) as {
    entity_type?: string
    site_id?: string
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)

  // Join Search Console performance into the audit when GSC is configured, so
  // findings can be reprioritized by real clicks/impressions/CTR.
  let performance: Awaited<
    ReturnType<typeof content.querySeoAnalyticsSafe>
  >["rows"] = []
  let performanceJoined = false
  const analyticsConfig = content.getSeoAnalyticsConfigSafe()
  if (analyticsConfig.status === "configured") {
    try {
      const now = Date.now()
      const result = await content.querySeoAnalyticsSafe({
        startDate: isoDate(now - 28 * 86400000),
        endDate: isoDate(now),
        dimension: "page",
        rowLimit: 5000,
      })
      performance = result.rows
      performanceJoined = true
    } catch {
      performanceJoined = false
    }
  }

  const report = await content.auditContentSeoSafe(
    {
      entityType: query.entity_type,
      siteId: query.site_id,
      limit: query.limit,
    },
    performance
  )

  res.json({ ...report, performance_joined: performanceJoined })
}
