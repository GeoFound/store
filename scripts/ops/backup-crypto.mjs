#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pipeline } from "node:stream/promises"

const MAGIC = "STORE_BACKUP_AES_256_GCM_V1"

const command = process.argv[2]
const inputPath = readArg("--in")
const outputPath = readArg("--out")

if (!["encrypt", "decrypt"].includes(command) || !inputPath || !outputPath) {
  console.error("usage: backup-crypto.mjs encrypt|decrypt --in <path> --out <path>")
  process.exit(2)
}

const key = decodeKey(process.env.BACKUP_ENCRYPTION_KEY || "")

if (command === "encrypt") {
  await encryptFile(inputPath, outputPath, key)
} else {
  await decryptFile(inputPath, outputPath, key)
}

async function encryptFile(input, output, keyValue) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", keyValue, iv)
  const tmpCiphertext = path.join(
    os.tmpdir(),
    `store-backup-ciphertext-${process.pid}-${Date.now()}`
  )

  await pipeline(fs.createReadStream(input), cipher, fs.createWriteStream(tmpCiphertext, {
    mode: 0o600,
  }))

  const header = {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    created_at: new Date().toISOString(),
  }

  await writeEncryptedOutput(output, header, tmpCiphertext)
  fs.rmSync(tmpCiphertext, { force: true })
}

async function decryptFile(input, output, keyValue) {
  const { header, offset } = readHeader(input)
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyValue,
    Buffer.from(header.iv, "base64")
  )
  decipher.setAuthTag(Buffer.from(header.tag, "base64"))

  await pipeline(
    fs.createReadStream(input, { start: offset }),
    decipher,
    fs.createWriteStream(output, { mode: 0o600 })
  )
}

async function writeEncryptedOutput(output, header, tmpCiphertext) {
  const tmpOutput = `${output}.tmp-${process.pid}`
  const outputStream = fs.createWriteStream(tmpOutput, { mode: 0o600 })
  outputStream.write(`${MAGIC} ${JSON.stringify(header)}\n`)
  await pipeline(fs.createReadStream(tmpCiphertext), outputStream)
  fs.renameSync(tmpOutput, output)
  fs.chmodSync(output, 0o600)
}

function readHeader(input) {
  const fd = fs.openSync(input, "r")
  const chunks = []
  const buffer = Buffer.alloc(1)
  let offset = 0

  try {
    while (fs.readSync(fd, buffer, 0, 1, offset) === 1) {
      offset += 1

      if (buffer[0] === 10) {
        break
      }

      chunks.push(Buffer.from(buffer))

      if (offset > 8192) {
        throw new Error("Encrypted backup header is too large")
      }
    }
  } finally {
    fs.closeSync(fd)
  }

  const line = Buffer.concat(chunks).toString("utf8")
  const prefix = `${MAGIC} `

  if (!line.startsWith(prefix)) {
    throw new Error("Backup file is not encrypted with the expected store format")
  }

  const header = JSON.parse(line.slice(prefix.length))

  if (!header.iv || !header.tag) {
    throw new Error("Encrypted backup header is missing iv or tag")
  }

  return { header, offset }
}

function decodeKey(value) {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be set")
  }

  const key = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64")

  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes")
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
