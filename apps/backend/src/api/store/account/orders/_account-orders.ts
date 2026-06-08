import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitOrderAccessTokenIssuedEvent } from "../../../../platform/events"
import { createOrderAccessProviderScope } from "../../../../platform-adapters/backend-context"
import {
  resolveConfiguredOrderAccessProviderCode,
  resolveOrderAccessProviderOrThrow,
} from "../../../../platform-adapters/order-access"
import { getRequestAuditContext } from "../../../../utils/request-audit"
import {
  STORE_ORDER_DETAIL_FIELDS,
  normalizeEmail,
} from "../../../../utils/store-order"

type CustomerRecord = {
  id?: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
}

type OrderRecord = {
  id?: string
  email?: string | null
  customer_id?: string | null
  created_at?: string | Date | null
  [key: string]: unknown
}

export async function listAuthenticatedCustomerAccountOrders(
  req: MedusaRequest,
  customerId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customerResult = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    filters: {
      id: customerId,
    },
  })
  const customer = customerResult.data?.[0] as CustomerRecord | undefined
  const customerEmail = normalizeEmail(customer?.email)

  const [byCustomer, byEmail] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["customer_id", ...STORE_ORDER_DETAIL_FIELDS],
      filters: {
        customer_id: customerId,
      },
    }),
    customerEmail
      ? query.graph({
          entity: "order",
          fields: ["customer_id", ...STORE_ORDER_DETAIL_FIELDS],
          filters: {
            email: customerEmail,
          },
        })
      : Promise.resolve({ data: [] }),
  ])

  const orders = dedupeOrders([
    ...((byCustomer.data || []) as OrderRecord[]),
    ...((byEmail.data || []) as OrderRecord[]),
  ])
  const orderAccess = resolveOrderAccessProviderOrThrow(
    resolveConfiguredOrderAccessProviderCode()
  )
  const orderAccessScope = createOrderAccessProviderScope(req.scope)
  const auditContext = getRequestAuditContext(req)

  const accountOrders = await Promise.all(
    orders.map(async (order) => {
      const issued = await orderAccess.issueToken({
        scope: orderAccessScope,
        orderId: String(order.id),
        customerEmail: customerEmail || normalizeEmail(order.email),
        purpose: "view_order",
        metadata: {
          source: "customer_account",
          customer_id: customerId,
        },
      })

      await emitOrderAccessTokenIssuedEvent(req.scope, {
        orderId: String(order.id),
        customerEmail: customerEmail || normalizeEmail(order.email),
        purpose: "view_order",
        source: "customer_account",
        actorType: "customer",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          customer_id: customerId,
        },
      })

      return {
        order,
        access_token: issued.token,
      }
    })
  )

  return {
    customer,
    orders: accountOrders,
  }
}

function dedupeOrders(orders: OrderRecord[]) {
  const byId = new Map<string, OrderRecord>()

  for (const order of orders) {
    if (!order.id) {
      continue
    }

    byId.set(String(order.id), order)
  }

  return [...byId.values()].sort((left, right) => {
    const leftTime = new Date(String(left.created_at || 0)).getTime()
    const rightTime = new Date(String(right.created_at || 0)).getTime()

    return rightTime - leftTime
  })
}
