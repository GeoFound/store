import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    ok: true,
    service: "backend",
    timestamp: new Date().toISOString(),
  })
}
