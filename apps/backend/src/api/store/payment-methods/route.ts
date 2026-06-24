import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveStorefrontPaymentApplication } from "../../../platform-adapters/payment-application"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const payment = resolveStorefrontPaymentApplication(req.scope)
  const query = (req.validatedQuery || req.query) as {
    amount?: number | string
    currency?: string
  }

  const methods = await payment.listPaymentMethods({
    amount: query.amount,
    currency: query.currency,
  })

  res.json({ methods })
}
