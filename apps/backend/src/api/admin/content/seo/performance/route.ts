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
    start_date?: string
    end_date?: string
    dimension?: "page" | "query" | "date"
    limit?: number
  }
  const content = resolveContentCoreService(req.scope)
  const config = content.getSeoAnalyticsConfigSafe()

  // Degrade gracefully when Search Console is not configured.
  if (config.status !== "configured") {
    res.json({
      config,
      performance: { configured: false, status: config.status, rows: [] },
    })
    return
  }

  const now = Date.now()
  const startDate = query.start_date || isoDate(now - 28 * 86400000)
  const endDate = query.end_date || isoDate(now)

  try {
    const performance = await content.querySeoAnalyticsSafe({
      startDate,
      endDate,
      dimension: query.dimension,
      rowLimit: query.limit,
    })
    res.json({ config, performance })
  } catch (err) {
    res.json({
      config,
      performance: {
        configured: true,
        status: config.status,
        site_url: config.site_url,
        start_date: startDate,
        end_date: endDate,
        dimension: query.dimension || "page",
        rows: [],
      },
      error: err instanceof Error ? err.message : "Search Console query failed",
    })
  }
}
