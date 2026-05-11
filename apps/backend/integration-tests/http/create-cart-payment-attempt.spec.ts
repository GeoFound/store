import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PAYMENT_ROUTER_MODULE } from "../../src/modules/payment-router"

jest.mock("../../src/workflows/create-cart-payment-attempt", () => {
  const run = jest.fn()

  return {
    __esModule: true,
    default: () => ({
      run,
    }),
    __runMock: run,
  }
})

import { POST } from "../../src/api/store/carts/[cart_id]/payments/route"

const workflowModule = jest.requireMock(
  "../../src/workflows/create-cart-payment-attempt"
) as {
  __runMock: jest.Mock
}
const runWorkflowMock = workflowModule.__runMock

type ContextInput = {
  cart: Record<string, unknown> | null
  paidAttempts?: Array<Record<string, unknown>>
  body?: Record<string, unknown>
}

function createContext(input: ContextInput) {
  const query = {
    graph: jest.fn().mockResolvedValue({
      data: input.cart ? [input.cart] : [],
    }),
  }
  const paymentRouter = {
    listPaymentAttempts: jest.fn().mockResolvedValue(input.paidAttempts || []),
  }
  const scope = {
    resolve: jest.fn((token: unknown) => {
      if (token === ContainerRegistrationKeys.QUERY) {
        return query
      }

      if (token === PAYMENT_ROUTER_MODULE) {
        return paymentRouter
      }

      throw new Error(`Unexpected scope token: ${String(token)}`)
    }),
  }
  const req = {
    params: {
      cart_id: "cart_test",
    },
    body: input.body || {},
    validatedBody: input.body || {},
    scope,
  }
  const res = {
    json: jest.fn(),
  }

  return {
    req,
    res,
    query,
    paymentRouter,
    scope,
  }
}

describe("POST /store/carts/:cart_id/payments", () => {
  beforeEach(() => {
    runWorkflowMock.mockReset()
  })

  it("rejects creating payment attempt for a completed cart", async () => {
    const { req, res } = createContext({
      cart: {
        id: "cart_test",
        completed_at: new Date().toISOString(),
        currency_code: "usd",
        total: 1000,
        email: "buyer@example.com",
        items: [{ id: "item_1", quantity: 1, unit_price: 1000 }],
      },
      paidAttempts: [],
    })

    await expect(POST(req as any, res as any)).rejects.toThrow(
      "already completed"
    )
    expect(runWorkflowMock).not.toHaveBeenCalled()
  })

  it("rejects creating payment attempt when payment is already confirmed", async () => {
    const { req, res } = createContext({
      cart: {
        id: "cart_test",
        completed_at: null,
        currency_code: "usd",
        total: 1000,
        email: "buyer@example.com",
        items: [{ id: "item_1", quantity: 1, unit_price: 1000 }],
      },
      paidAttempts: [
        {
          id: "pa_paid_1",
          status: "paid",
        },
      ],
    })

    await expect(POST(req as any, res as any)).rejects.toThrow(
      "Payment is already confirmed for this cart"
    )
    expect(runWorkflowMock).not.toHaveBeenCalled()
  })

  it("creates payment attempt for open cart and returns normalized response", async () => {
    const { req, res } = createContext({
      cart: {
        id: "cart_test",
        completed_at: null,
        currency_code: "usd",
        total: 1500,
        subtotal: 1500,
        email: "buyer@example.com",
        items: [{ id: "item_1", quantity: 1, unit_price: 1500 }],
      },
      paidAttempts: [],
      body: {
        payment_method: "manual",
      },
    })

    runWorkflowMock.mockResolvedValue({
      result: {
        attempt: {
          id: "pa_new_1",
          cart_id: "cart_test",
          provider_order_id: "manual_001",
          amount: 1500,
          currency: "usd",
          status: "pending",
          provider_code: "manual",
        },
        instructions: {
          title: "Manual payment pending",
          body: "Use manual channel",
          reference: "pay_abc123",
        },
        claimToken: "claim_token_1",
        marketingContext: {
          tags: ["checkout"],
        },
      },
    })

    await POST(req as any, res as any)

    expect(runWorkflowMock).toHaveBeenCalledTimes(1)
    expect(res.json).toHaveBeenCalledWith({
      attempt: {
        id: "pa_new_1",
        cart_id: "cart_test",
        provider_order_id: "manual_001",
        amount: 1500,
        currency: "usd",
        status: "pending",
        provider_code: "manual",
      },
      instructions: {
        title: "Manual payment pending",
        body: "Use manual channel",
        reference: "pay_abc123",
      },
      claim_token: "claim_token_1",
      marketing: {
        tags: ["checkout"],
      },
    })
  })
})
