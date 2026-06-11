import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { retrieveOrder } from "@/lib/commerce"
import { OrderLookupView } from "./order-lookup-view"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

vi.mock("@/lib/commerce", () => ({
  confirmDelivery: vi.fn(),
  confirmOrderDelivery: vi.fn(),
  createAfterSale: vi.fn(),
  createOrderAfterSale: vi.fn(),
  recoverOrder: vi.fn(),
  retrieveDelivery: vi.fn(),
  retrieveOrder: vi.fn(),
  verifyOrderRecovery: vi.fn(),
}))

const retrieveOrderMock = vi.mocked(retrieveOrder)

describe("OrderLookupView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState({}, "", "/orders")
    retrieveOrderMock.mockResolvedValue({
      order: {
        id: "order_1",
        status: "pending",
        currency_code: "usd",
        custom_display_id: null,
        display_id: null,
      },
      deliveries: [],
    } as Awaited<ReturnType<typeof retrieveOrder>>)
  })

  it("does not lookup while a customer manually types a token", async () => {
    const user = userEvent.setup()

    render(<OrderLookupView />)

    await user.type(screen.getByLabelText("Order access token"), "ord_manual")

    expect(retrieveOrderMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "View order" }))

    await waitFor(() => {
      expect(retrieveOrderMock).toHaveBeenCalledTimes(1)
    })
    expect(retrieveOrderMock).toHaveBeenCalledWith("ord_manual")
  })

  it("loads a stored token once on initial render", async () => {
    window.sessionStorage.setItem(
      "store_session_order_access_token",
      "ord_saved"
    )

    render(<OrderLookupView />)

    await waitFor(() => {
      expect(retrieveOrderMock).toHaveBeenCalledTimes(1)
    })
    expect(retrieveOrderMock).toHaveBeenCalledWith("ord_saved")
  })
})
