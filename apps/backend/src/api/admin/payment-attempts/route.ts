import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePaymentRouterService } from "../../../platform/services"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const paymentRouter = resolvePaymentRouterService(req.scope)
  const query = (req.validatedQuery || req.query) as {
    status?: string
    cart_id?: string
    provider_code?: string
    limit?: number
  }

  const attempts = await paymentRouter.listPaymentAttempts(
    {
      ...(query.status ? { status: query.status } : {}),
      ...(query.cart_id ? { cart_id: query.cart_id } : {}),
      ...(query.provider_code ? { provider_code: query.provider_code } : {}),
    },
    {
      take:
        typeof query.limit === "number" && Number.isFinite(query.limit)
          ? query.limit
          : 50,
      order: {
        created_at: "DESC",
      },
    }
  )

  res.json({
    attempts,
  })
}
