import type {
  SupplierProcureInput,
  SupplierProcureResult,
  SupplierProvider,
  SupplierRetrieveInput,
} from "../../platform/supplier"
import { getG2aConfig } from "./config"

export const g2aSupplierProvider: SupplierProvider = {
  code: "g2a",

  isConfigured() {
    return getG2aConfig().configured
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
    const config = getG2aConfig()
    assertConfigured(config.configured)
    const url = `${config.baseUrl}${resolveProcurePath(input)}`
    const response = await postJson(
      url,
      buildCreateOrderBody(input),
      config.token,
      input.idempotencyKey
    )
    const providerOrderId = resolveProviderOrderId(response, input)
    const keys = extractKeys(response)

    if (keys.length) {
      return fulfilledResult(response, input, providerOrderId, keys)
    }

    const status = resolveResultStatus(response)

    if (status === "failed") {
      return {
        providerOrderId,
        status: "failed",
        raw: response,
        message: text(response.message) || "G2A procurement failed",
      }
    }

    if (providerOrderId) {
      try {
        const retrieved = await retrieveKeys(config, input, providerOrderId)
        const retrievedKeys = extractKeys(retrieved)

        if (retrievedKeys.length) {
          return fulfilledResult(retrieved, input, providerOrderId, retrievedKeys)
        }
      } catch {
        // Keep the procurement pending; reconciliation or admin retry can fetch keys later.
      }
    }

    return {
      providerOrderId,
      status: "pending",
      raw: response,
      message: "G2A order was created but keys are not available yet",
    }
  },

  async retrieveFulfillment(input) {
    const config = getG2aConfig()
    assertConfigured(config.configured)
    const response = await retrieveKeys(config, input, input.providerOrderId)
    const keys = extractKeys(response)

    if (keys.length) {
      return fulfilledResult(
        response,
        {
          providerSku: input.providerSku || "",
          idempotencyKey: input.providerOrderId,
          quantity: keys.length,
          metadata: input.metadata,
          mapping: input.mapping,
        },
        input.providerOrderId,
        keys
      )
    }

    return {
      providerOrderId: input.providerOrderId,
      status: resolveResultStatus(response),
      raw: response,
      message: "G2A keys are not available yet",
    }
  },
}

async function retrieveKeys(
  config: ReturnType<typeof getG2aConfig>,
  input: { metadata?: Record<string, unknown> },
  providerOrderId: string
) {
  const path = resolveRetrievePath(input).replace(
    "{providerOrderId}",
    encodeURIComponent(providerOrderId)
  )

  return getJson(`${config.baseUrl}${path}`, config.token)
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
      `G2A request failed with status ${response.status}: ${textBody.slice(
        0,
        500
      )}`
    )
  }

  return body
}

function buildCreateOrderBody(input: SupplierProcureInput) {
  const metadata = normalizeRecord(input.metadata)
  const override = normalizeRecord(metadata.supplier_request_body)

  if (Object.keys(override).length) {
    return override
  }

  return {
    product_id:
      text(input.mapping?.provider_product_id) ||
      text(input.mapping?.provider_variant_id) ||
      input.providerSku,
    quantity: input.quantity,
    max_price:
      numberOrNull(metadata.supplier_max_price) ??
      numberOrNull(input.mapping?.list_price) ??
      undefined,
    currency: text(input.currency) || text(input.mapping?.currency) || undefined,
    custom_id: input.idempotencyKey,
  }
}

function fulfilledResult(
  response: Record<string, unknown>,
  input: Partial<SupplierProcureInput>,
  providerOrderId: string | null,
  keys: Array<Record<string, unknown>>
): SupplierProcureResult {
  return {
    providerOrderId,
    status: "fulfilled",
    deliveryPayload: {
      supplier_provider: "g2a",
      supplier_provider_order_id: providerOrderId,
      supplier_sku: input.providerSku || null,
      fulfillment: keys.map((key) => ({
        key:
          text(key.key) ||
          text(key.code) ||
          text(key.serial) ||
          text(key.value) ||
          undefined,
        serial: text(key.serial) || text(key.serial_number) || undefined,
        raw: key,
      })),
    },
    costAmount: numberOrNull(response.total_price) ?? numberOrNull(response.price),
    costCurrency: text(response.currency) || text(input.currency) || null,
    raw: response,
    message: "G2A keys fulfilled",
  }
}

function extractKeys(response: Record<string, unknown>) {
  const arrays = [
    response.keys,
    response.codes,
    response.items,
    normalizeRecord(response.data).keys,
    normalizeRecord(response.data).items,
  ]

  for (const value of arrays) {
    if (Array.isArray(value) && value.length) {
      return value.map((item) =>
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : { key: item }
      )
    }
  }

  const key = text(response.key) || text(response.code)

  return key ? [{ key }] : []
}

function resolveProcurePath(input: { metadata?: Record<string, unknown> }) {
  const metadata = normalizeRecord(input.metadata)

  return text(metadata.supplier_procure_path) || text(metadata.g2a_procure_path) || "/orders"
}

function resolveRetrievePath(input: { metadata?: Record<string, unknown> }) {
  const metadata = normalizeRecord(input.metadata)

  return (
    text(metadata.supplier_retrieve_path) ||
    text(metadata.g2a_retrieve_path) ||
    "/orders/{providerOrderId}/keys"
  )
}

function resolveProviderOrderId(
  response: Record<string, unknown>,
  input: { idempotencyKey: string }
) {
  return (
    text(response.order_id) ||
    text(response.orderId) ||
    text(response.id) ||
    text(normalizeRecord(response.data).id) ||
    input.idempotencyKey
  )
}

function resolveResultStatus(response: Record<string, unknown>) {
  const status = (
    text(response.status) ||
    text(normalizeRecord(response.data).status) ||
    "pending"
  ).toLowerCase()

  if (["failed", "cancelled", "canceled", "rejected"].includes(status)) {
    return "failed"
  }

  if (["completed", "complete", "fulfilled", "paid", "done"].includes(status)) {
    return "fulfilled"
  }

  return "pending"
}

function assertConfigured(configured: boolean) {
  if (!configured) {
    throw new Error(
      "G2A supplier is not configured. Set G2A_ACCESS_TOKEN, G2A_API_TOKEN, or G2A_API_KEY."
    )
  }
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
