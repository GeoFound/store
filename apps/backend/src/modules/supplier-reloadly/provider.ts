import type {
  SupplierProcureInput,
  SupplierProcureResult,
  SupplierProvider,
  SupplierRetrieveInput,
} from "../../platform/supplier"
import { getReloadlyConfig } from "./config"
import {
  assertConfigured,
  firstArray,
  normalizeRecord,
  numberOrNull,
  resolveProviderOrderId,
  resolveResultStatus,
  resolveRetrievePath,
  text,
} from "./provider-helpers"

let cachedToken: {
  accessToken: string
  expiresAt: number
} | null = null

export const reloadlySupplierProvider: SupplierProvider = {
  code: "reloadly",

  isConfigured() {
    return getReloadlyConfig().configured
  },

  quote(input) {
    return {
      available: true,
      providerSku: input.providerSku,
      providerProductId: input.mapping?.provider_product_id || input.providerSku,
      unitCost: numberOrNull(input.metadata?.supplier_unit_cost),
      currency:
        text(input.currency) ||
        text(input.mapping?.currency) ||
        text(input.metadata?.supplier_currency) ||
        null,
      raw: {
        mode: "static",
      },
    }
  },

  async procure(input) {
    const operation = resolveOperation(input)
    const config = getReloadlyConfig()
    assertConfigured(config.configured)
    const token = await getAccessToken(config)
    const url = `${resolveBaseUrl(config, operation)}${resolveProcurePath(
      input,
      operation
    )}`
    const body = buildRequestBody(input, operation, config.senderName)
    const response = await postJson(url, body, token, input.idempotencyKey)
    const providerOrderId = resolveProviderOrderId(response, input)
    const status = resolveResultStatus(response)

    return {
      providerOrderId,
      status,
      deliveryPayload:
        status === "fulfilled"
          ? buildDeliveryPayload(response, input, providerOrderId, operation)
          : undefined,
      costAmount: numberOrNull(response.amount) ?? numberOrNull(response.unitPrice),
      costCurrency:
        text(response.currencyCode) ||
        text(response.currency) ||
        text(input.currency) ||
        null,
      raw: response,
      message:
        status === "pending"
          ? "Reloadly procurement is pending"
          : "Reloadly procurement fulfilled",
    }
  },

  async retrieveFulfillment(input) {
    const config = getReloadlyConfig()
    assertConfigured(config.configured)
    const operation = resolveOperation(input)
    const token = await getAccessToken(config)
    const retrievePath = resolveRetrievePath(input)

    if (!retrievePath) {
      return {
        providerOrderId: input.providerOrderId,
        status: "pending",
        message: "Reloadly retrieve path is not configured",
      }
    }

    const url = `${resolveBaseUrl(config, operation)}${retrievePath.replace(
      "{providerOrderId}",
      encodeURIComponent(input.providerOrderId)
    )}`
    const response = await getJson(url, token)
    const status = resolveResultStatus(response)

    return {
      providerOrderId: resolveProviderOrderId(response, {
        providerSku: input.providerSku || "",
        idempotencyKey: input.providerOrderId,
      }),
      status,
      deliveryPayload:
        status === "fulfilled"
          ? buildDeliveryPayload(
              response,
              {
                providerSku: input.providerSku || "",
                idempotencyKey: input.providerOrderId,
                quantity: 1,
                metadata: input.metadata,
                mapping: input.mapping,
              },
              input.providerOrderId,
              operation
            )
          : undefined,
      raw: response,
    }
  },
}

async function getAccessToken(config: ReturnType<typeof getReloadlyConfig>) {
  const now = Date.now()

  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.accessToken
  }

  const response = await fetch(config.authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      audience: config.audience,
    }),
  })

  const json = (await parseJsonResponse(response)) as Record<string, unknown>
  const accessToken = text(json.access_token)

  if (!accessToken) {
    throw new Error("Reloadly auth response did not include access_token")
  }

  cachedToken = {
    accessToken,
    expiresAt: now + (Number(json.expires_in || 3000) - 60) * 1000,
  }

  return accessToken
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  token: string,
  idempotencyKey: string
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  })

  return (await parseJsonResponse(response)) as Record<string, unknown>
}

async function getJson(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  return (await parseJsonResponse(response)) as Record<string, unknown>
}

async function parseJsonResponse(response: Response) {
  const textBody = await response.text()
  let body: unknown = {}

  if (textBody.trim()) {
    try {
      body = JSON.parse(textBody)
    } catch {
      body = {
        raw: textBody,
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      `Reloadly request failed with status ${response.status}: ${textBody.slice(
        0,
        500
      )}`
    )
  }

  return body
}

function buildRequestBody(
  input: SupplierProcureInput,
  operation: string,
  senderName: string
) {
  const metadata = normalizeRecord(input.metadata)
  const override = normalizeRecord(metadata.supplier_request_body)

  if (Object.keys(override).length) {
    return {
      ...override,
      customIdentifier:
        text(override.customIdentifier) ||
        text(override.custom_identifier) ||
        input.idempotencyKey,
    }
  }

  if (operation === "airtime") {
    return {
      operatorId:
        numberOrNull(input.mapping?.provider_product_id) ??
        numberOrNull(input.providerSku) ??
        input.providerSku,
      amount:
        numberOrNull(metadata.supplier_amount) ??
        numberOrNull(metadata.amount) ??
        numberOrNull(input.mapping?.list_price),
      recipientPhone: normalizeRecord(metadata.recipient_phone),
      customIdentifier: input.idempotencyKey,
    }
  }

  return {
    productId:
      numberOrNull(input.mapping?.provider_product_id) ??
      numberOrNull(input.providerSku) ??
      input.providerSku,
    countryCode:
      text(input.regionCode) ||
      text(input.mapping?.region_code) ||
      text(metadata.country_code) ||
      text(metadata.countryCode) ||
      undefined,
    quantity: input.quantity,
    unitPrice:
      numberOrNull(metadata.supplier_unit_price) ??
      numberOrNull(metadata.denomination) ??
      numberOrNull(input.mapping?.list_price) ??
      undefined,
    customIdentifier: input.idempotencyKey,
    recipientEmail: input.customerEmail || undefined,
    senderName,
  }
}

function buildDeliveryPayload(
  response: Record<string, unknown>,
  input: Partial<SupplierProcureInput>,
  providerOrderId: string | null,
  operation: string
) {
  const cards = firstArray(
    response.cards,
    response.giftCards,
    response.gift_cards,
    response.items
  )

  return {
    supplier_provider: "reloadly",
    supplier_operation: operation,
    supplier_provider_order_id: providerOrderId,
    supplier_sku: input.providerSku || null,
    fulfillment: cards.length
      ? cards.map((card) => normalizeReloadlyCard(card))
      : normalizeReloadlyCard(response),
  }
}

function normalizeReloadlyCard(value: unknown) {
  const record = normalizeRecord(value)

  return {
    card_number:
      text(record.cardNumber) ||
      text(record.card_number) ||
      text(record.giftCardNumber) ||
      undefined,
    pin_code:
      text(record.pinCode) ||
      text(record.pin_code) ||
      text(record.pin) ||
      undefined,
    redeem_code:
      text(record.redeemCode) ||
      text(record.redeem_code) ||
      text(record.code) ||
      undefined,
    serial_number:
      text(record.serialNumber) || text(record.serial_number) || undefined,
    claim_url:
      text(record.claimUrl) ||
      text(record.claim_url) ||
      text(record.url) ||
      undefined,
    transaction_id:
      text(record.transactionId) ||
      text(record.transaction_id) ||
      text(record.id) ||
      undefined,
    raw: record,
  }
}

function resolveOperation(input: { metadata?: Record<string, unknown> }) {
  const metadata = normalizeRecord(input.metadata)
  const explicit =
    text(metadata.reloadly_operation) ||
    text(metadata.supplier_operation) ||
    text(metadata.reloadly_product_type)

  if (explicit) {
    return explicit.replace(/_/g, "-")
  }

  const templateCode = text(metadata.template_code)

  return templateCode.includes("airtime") ? "airtime" : "gift-card"
}

function resolveBaseUrl(
  config: ReturnType<typeof getReloadlyConfig>,
  operation: string
) {
  return operation === "airtime" ? config.airtimeBaseUrl : config.giftcardsBaseUrl
}

function resolveProcurePath(
  input: { metadata?: Record<string, unknown> },
  operation: string
) {
  const metadata = normalizeRecord(input.metadata)

  return (
    text(metadata.supplier_procure_path) ||
    text(metadata.reloadly_procure_path) ||
    (operation === "airtime" ? "/topups" : "/orders")
  )
}
