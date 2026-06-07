import { describe, expect, it } from "vitest"
import { formatMoney, getVariantPrice } from "./format"

describe("format helpers", () => {
  it("formats minor-unit money with an uppercase currency code", () => {
    expect(formatMoney(1299, "usd")).toBe("$12.99")
  })

  it("reports pending prices when no numeric amount is available", () => {
    expect(formatMoney(undefined, "usd")).toBe("Price pending")
  })

  it("prefers tax-inclusive calculated variant prices", () => {
    expect(
      getVariantPrice({
        calculated_price: {
          amount: 1000,
          calculated_amount: 1200,
          calculated_amount_with_tax: 1320,
          currency_code: "jpy",
        },
      })
    ).toEqual({
      amount: 1320,
      currencyCode: "jpy",
    })
  })
})
