import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handlePaymentWebhook } from "../_handle-payment-webhook"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  await handlePaymentWebhook(req, res, {
    providerCode: "manual",
    source: "manual_webhook",
  })
}
