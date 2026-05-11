import crypto from "crypto"

export function createTokenWithPrefix(prefix: string) {
  return `${prefix}_${crypto.randomBytes(24).toString("base64url")}`
}

export function createRecoveryCode() {
  const value = crypto.randomInt(0, 1_000_000)
  return value.toString().padStart(6, "0")
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function createTokenHint(value: string) {
  return value.slice(-6)
}

export function addSeconds(value: Date, seconds: number) {
  return new Date(value.getTime() + seconds * 1000)
}
