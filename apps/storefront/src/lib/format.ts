export function formatMoney(
  amount?: number | null,
  currencyCode = "eur",
): string {
  if (typeof amount !== "number") {
    return "Price pending"
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount / 100)
}

export function getVariantPrice(variant?: {
  calculated_price?: {
    calculated_amount?: number
    calculated_amount_with_tax?: number
    amount?: number
    currency_code?: string
  }
}) {
  const price = variant?.calculated_price

  return {
    amount:
      price?.calculated_amount_with_tax ??
      price?.calculated_amount ??
      price?.amount,
    currencyCode: price?.currency_code || "eur",
  }
}
