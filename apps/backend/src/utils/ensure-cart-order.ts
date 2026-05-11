import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { CART_ORDER_QUERY_FIELDS, buildOrderFromCart } from "./cart-order"

type CartReference = {
  id?: string | null
  email?: string | null
  customer_id?: string | null
  customer?: {
    id?: string | null
  } | null
}

export async function ensureCartOrder(
  container: MedusaContainer,
  input: {
    cartId: string
    orderId?: string | null
    transactionReferenceId?: string
  }
) {
  if (input.orderId) {
    return { id: input.orderId }
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const existing = await query.graph({
    entity: "order_cart",
    fields: ["cart_id", "order_id"],
    filters: {
      cart_id: input.cartId,
    },
  })
  const existingLink = existing.data?.[0]

  if (existingLink?.order_id) {
    return {
      id: existingLink.order_id,
    }
  }

  const cartResult = await query.graph({
    entity: "cart",
    fields: CART_ORDER_QUERY_FIELDS,
    filters: {
      id: input.cartId,
    },
  })
  const cart = cartResult.data?.[0]

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart was not found")
  }

  const customerId = await ensureGuestCustomerForCart(container, cart)
  const orderModuleService = container.resolve(Modules.ORDER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const orderInput = buildOrderFromCart({
    cart,
    customerId,
    transactionReferenceId: input.transactionReferenceId,
  })
  const createdOrder = await orderModuleService.createOrders(orderInput)

  await link.create({
    [Modules.ORDER]: { order_id: createdOrder.id },
    [Modules.CART]: { cart_id: cart.id },
  })

  return createdOrder
}

async function ensureGuestCustomerForCart(
  container: MedusaContainer,
  cart: CartReference
) {
  if (typeof cart.id !== "string" || !cart.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart id is required"
    )
  }

  const existingCustomerId = cart.customer?.id || cart.customer_id
  if (existingCustomerId) {
    return existingCustomerId
  }

  if (!cart.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Guest checkout cart must have an email"
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const customerModuleService = container.resolve(Modules.CUSTOMER)
  const cartModuleService = container.resolve(Modules.CART)

  const customers = await query.graph({
    entity: "customer",
    fields: ["id", "email", "has_account"],
    filters: {
      email: cart.email,
      has_account: false,
    },
  })

  const existingCustomer = customers.data?.[0]
  const customer =
    existingCustomer ||
    (await customerModuleService.createCustomers({
      email: cart.email,
      has_account: false,
      metadata: {
        source: "guest_checkout",
      },
    }))

  await cartModuleService.updateCarts(cart.id, {
    customer_id: customer.id,
    email: cart.email,
  })

  return customer.id
}
