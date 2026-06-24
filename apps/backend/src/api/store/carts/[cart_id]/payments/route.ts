import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MarketingCheckoutContextInput } from "../../../../../platform/marketing"
import type { PaymentMethodCode } from "../../../../../platform/payment-providers"
import { resolveStorefrontPaymentApplication } from "../../../../../platform-adapters/payment-application"

type CreateCartPaymentBody = {
  payment_method: PaymentMethodCode
  marketing?: MarketingCheckoutContextInput
  analytics?: {
    ga_client_id?: string
    ga_session_id?: string
    page_location?: string
    page_path?: string
    referrer?: string
  }
}

export const POST = async (
  req: MedusaRequest<CreateCartPaymentBody>,
  res: MedusaResponse
) => {
  const body = (req.validatedBody || req.body) as CreateCartPaymentBody
  const payment = resolveStorefrontPaymentApplication(req.scope)
  const result = await payment.createCartPayment({
    cartId: req.params.cart_id,
    paymentMethod: body.payment_method,
    marketing: body.marketing,
    analytics: body.analytics,
  })

  res.json(result)
}
