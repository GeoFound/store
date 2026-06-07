import crypto from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import {
  decodeEncryptionKey,
  resolveEncryptionKeyRing,
} from "../../utils/runtime-secrets"
import {
  buildDefaultSupplierDeliveryPayload,
  toOptionalText,
} from "./service-helpers"

type SupplierProcurementOrderRecord = Record<string, any>

export function encryptFulfillmentPayload(
  payload: Record<string, unknown> | string
) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const plaintext =
    typeof payload === "string" ? payload : JSON.stringify(payload)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    data: encrypted.toString("base64"),
  })
}

export function decryptStoredFulfillmentPayload(
  order: SupplierProcurementOrderRecord
) {
  const blob = toOptionalText(order.fulfillment_payload_encrypted)

  if (!blob) {
    return buildDefaultSupplierDeliveryPayload(order, {
      status: "fulfilled",
    })
  }

  const parsed = parseEncryptedPayload(blob)

  if (parsed.alg !== "aes-256-gcm" || !parsed.iv || !parsed.tag || !parsed.data) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Supplier fulfillment payload is missing encryption fields"
    )
  }

  for (const key of getDecryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(parsed.iv, "base64")
      )
      decipher.setAuthTag(Buffer.from(parsed.tag, "base64"))

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, "base64")),
        decipher.final(),
      ]).toString("utf8")

      try {
        return JSON.parse(decrypted)
      } catch {
        return decrypted
      }
    } catch {
      continue
    }
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Supplier fulfillment payload could not be decrypted"
  )
}

function parseEncryptedPayload(blob: string) {
  try {
    return JSON.parse(blob) as {
      alg?: string
      iv?: string
      tag?: string
      data?: string
    }
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Supplier fulfillment payload is not valid JSON"
    )
  }
}

function getEncryptionKey() {
  return getDecryptionKeys()[0]
}

function getDecryptionKeys() {
  try {
    const keyValues = resolveEncryptionKeyRing("SUPPLIER_ENCRYPTION_KEY", {
      fallbackName: "DELIVERY_ENCRYPTION_KEY",
      previousNames: [
        "SUPPLIER_ENCRYPTION_KEY_PREVIOUS",
        "DELIVERY_ENCRYPTION_KEY_PREVIOUS",
      ],
    })

    return keyValues.map((value) =>
      decodeEncryptionKey(value, "SUPPLIER_ENCRYPTION_KEY")
    )
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      error instanceof Error
        ? error.message
        : "Supplier encryption key configuration is invalid"
    )
  }
}
