#!/usr/bin/env node
import crypto from "node:crypto"
import process from "node:process"

const primaryName = readArg("--primary")
const previousNames = readArg("--previous")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)

if (!primaryName) {
  console.error("usage: reencrypt-payload.mjs --primary <ENV_NAME> [--previous <ENV,ENV>]")
  process.exit(2)
}

const blob = await readStdin()
const keys = resolveKeyRing(primaryName, previousNames)
const payload = decryptPayload(blob, keys)

process.stdout.write(encryptPayload(payload, keys[0]))

function decryptPayload(blobValue, keysValue) {
  const parsed = JSON.parse(blobValue)

  if (parsed.alg !== "aes-256-gcm" || !parsed.iv || !parsed.tag || !parsed.data) {
    throw new Error("Encrypted payload is missing aes-256-gcm fields")
  }

  for (const key of keysValue) {
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(parsed.iv, "base64")
      )
      decipher.setAuthTag(Buffer.from(parsed.tag, "base64"))

      return Buffer.concat([
        decipher.update(Buffer.from(parsed.data, "base64")),
        decipher.final(),
      ]).toString("utf8")
    } catch {
      continue
    }
  }

  throw new Error("Encrypted payload could not be decrypted by the configured key ring")
}

function encryptPayload(plaintext, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  return JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  })
}

function resolveKeyRing(primary, previous) {
  const keyNames = [primary, ...previous]
  const values = []

  for (const keyName of keyNames) {
    const raw = process.env[keyName]?.trim() || ""

    if (!raw) {
      continue
    }

    for (const entry of raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)) {
      values.push(decodeKey(entry, keyName))
    }
  }

  if (!values.length) {
    throw new Error(`${primary} must be configured`)
  }

  return values
}

function decodeKey(value, name) {
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64")

  if (key.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes`)
  }

  return key
}

function readArg(name) {
  const index = process.argv.indexOf(name)

  if (index === -1 || index + 1 >= process.argv.length) {
    return ""
  }

  return process.argv[index + 1]
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => resolve(data.trim()))
    process.stdin.on("error", reject)
  })
}
