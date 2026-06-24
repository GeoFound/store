export type StorefrontPaymentMethodListInput = {
  amount?: number | string | null
  currency?: string | null
}

export type StorefrontPaymentMethodQuery = {
  amount?: number
  currency?: string
}

export type StorefrontPaymentChannel = {
  id: string
  code: string
  display_name: string
  type: string
  priority: number
  health_status: string
}

export type StorefrontPaymentMethod = {
  id: string
  code: string
  display_name: string
  type: string
  priority: number
  health_status: string
}

export type StorefrontPaymentRepository = {
  listAvailablePaymentChannels(
    input: StorefrontPaymentMethodQuery
  ): Promise<StorefrontPaymentChannel[]>
}

export type StorefrontPaymentApplication = {
  listPaymentMethods(
    input?: StorefrontPaymentMethodListInput
  ): Promise<StorefrontPaymentMethod[]>
}

export function createStorefrontPaymentApplication(
  repository: StorefrontPaymentRepository
): StorefrontPaymentApplication {
  return {
    async listPaymentMethods(input = {}) {
      const channels = await repository.listAvailablePaymentChannels({
        amount: optionalAmount(input.amount),
        currency: optionalCurrency(input.currency),
      })

      return channels.map((channel) => ({
        id: channel.id,
        code: channel.code,
        display_name: channel.display_name,
        type: channel.type,
        priority: channel.priority,
        health_status: channel.health_status,
      }))
    },
  }
}

function optionalAmount(value: StorefrontPaymentMethodListInput["amount"]) {
  if (value === null || typeof value === "undefined" || value === "") {
    return undefined
  }

  const numberValue =
    typeof value === "number" ? value : Number(String(value).trim())

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return undefined
  }

  return numberValue
}

function optionalCurrency(value: StorefrontPaymentMethodListInput["currency"]) {
  if (value === null || typeof value === "undefined") {
    return undefined
  }

  const currency = String(value).trim().toLowerCase()

  return /^[a-z]{3}$/.test(currency) ? currency : undefined
}
