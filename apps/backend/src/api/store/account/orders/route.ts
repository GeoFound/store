import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAuthenticatedCustomerAccountOrders } from "./_account-orders"

type AuthenticatedRequest = MedusaRequest & {
  auth_context?: {
    actor_id?: string
    actor_type?: string
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const authContext = (req as AuthenticatedRequest).auth_context
  const customerId = String(authContext?.actor_id || "")

  if (!customerId) {
    res.status(401).json({ message: "Customer authentication is required." })
    return
  }

  res.json(await listAuthenticatedCustomerAccountOrders(req, customerId))
}
