import type { OrderAccessProvider } from "../../platform/order-access"
import { GUEST_ORDER_ACCESS_MODULE } from "."
import type GuestOrderAccessModuleService from "./service"

export const guestOrderAccessProvider: OrderAccessProvider = {
  code: "guest-order-access",

  async issueToken(input) {
    const guestOrderAccess: GuestOrderAccessModuleService = input.scope.resolve(
      GUEST_ORDER_ACCESS_MODULE
    )

    return guestOrderAccess.issueOrderAccessToken({
      orderId: input.orderId,
      customerEmail: input.customerEmail,
      purpose: input.purpose,
      expiresAt: input.expiresAt || undefined,
      metadata: input.metadata,
    })
  },

  async revokeActiveTokens(input) {
    const guestOrderAccess: GuestOrderAccessModuleService = input.scope.resolve(
      GUEST_ORDER_ACCESS_MODULE
    )

    return guestOrderAccess.revokeActiveTokens(input.orderId, input.purpose)
  },
}
