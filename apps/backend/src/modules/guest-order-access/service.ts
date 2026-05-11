import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import OrderAccessToken from "./models/order-access-token"
import type {
  IssueOrderAccessTokenInput,
  OrderAccessPurpose,
  VerifyRecoveryCodeInput,
} from "./types"
import {
  addSeconds,
  createRecoveryCode,
  createTokenHint,
  createTokenWithPrefix,
  hashToken,
} from "../../utils/token"

const DEFAULT_RECOVERY_MAX_FAILED_ATTEMPTS = 5
const DEFAULT_RECOVERY_BLOCK_SECONDS = 10 * 60

class GuestOrderAccessModuleService extends MedusaService({
  OrderAccessToken,
}) {
  async issueOrderAccessToken(input: IssueOrderAccessTokenInput) {
    const purpose = input.purpose || "view_order"

    if (purpose === "view_order" || purpose === "claim_order") {
      await this.revokeActiveTokens(input.orderId, purpose)
    }

    const token =
      purpose === "view_order"
        ? createTokenWithPrefix("ord")
        : createRecoveryCode()
    const expiresAt =
      input.expiresAt ??
      (purpose === "view_order"
        ? addSeconds(new Date(), 30 * 24 * 60 * 60)
        : addSeconds(new Date(), 15 * 60))

    const record = await this.createOrderAccessTokens({
      order_id: input.orderId,
      customer_email: input.customerEmail,
      purpose,
      token_hash: hashToken(token),
      token_hint: createTokenHint(token),
      expires_at: expiresAt,
      used_at: null,
      revoked_at: null,
      failed_attempts: 0,
      last_failed_at: null,
      blocked_until: null,
      metadata_json: input.metadata ?? null,
    })

    return {
      token,
      record: this.sanitizeToken(record),
    }
  }

  async createRecoveryCode(input: {
    orderId: string
    customerEmail: string
    metadata?: Record<string, unknown> | null
    ttlSeconds?: number
  }) {
    return this.issueOrderAccessToken({
      orderId: input.orderId,
      customerEmail: input.customerEmail,
      purpose: "claim_order",
      expiresAt: addSeconds(new Date(), input.ttlSeconds || 15 * 60),
      metadata: input.metadata ?? null,
    })
  }

  async resolveViewToken(token: string) {
    return this.resolveTokenByPurpose(token, "view_order")
  }

  async verifyRecoveryCode(input: VerifyRecoveryCodeInput) {
    const candidates = await this.listOrderAccessTokens({
      order_id: input.orderId,
      customer_email: input.customerEmail,
      purpose: "claim_order",
    })
    const now = new Date()
    const activeCandidates = candidates.filter((candidate) =>
      this.isTokenAvailableForVerification(candidate, now)
    )

    if (!activeCandidates.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Recovery code was not found"
      )
    }

    const blockedToken = activeCandidates.find(
      (candidate) =>
        candidate.blocked_until &&
        new Date(String(candidate.blocked_until)).getTime() > now.getTime()
    )

    if (blockedToken) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Too many invalid recovery attempts. Please retry later."
      )
    }

    const match = activeCandidates.find(
      (candidate) => candidate.token_hash === hashToken(input.code)
    )

    if (!match) {
      await this.registerRecoveryVerificationFailure(activeCandidates, now)
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Recovery code is invalid"
      )
    }

    this.assertTokenIsActive(match)

    const updated = await this.updateOrderAccessTokens({
      id: match.id,
      used_at: new Date(),
      failed_attempts: 0,
      last_failed_at: null,
      blocked_until: null,
    })

    return this.sanitizeToken(updated)
  }

  async revokeActiveTokens(orderId: string, purpose?: OrderAccessPurpose) {
    const tokens = await this.listOrderAccessTokens({
      order_id: orderId,
      ...(purpose ? { purpose } : {}),
    })

    const revokedAt = new Date()
    const revoked: Array<Record<string, unknown>> = []

    for (const token of tokens) {
      if (token.revoked_at) {
        revoked.push(this.sanitizeToken(token))
        continue
      }

      const updated = await this.updateOrderAccessTokens({
        id: token.id,
        revoked_at: revokedAt,
      })
      revoked.push(this.sanitizeToken(updated))
    }

    return revoked
  }

  async listTokensSafe(input?: {
    orderId?: string
    customerEmail?: string
    purpose?: OrderAccessPurpose
    limit?: number
  }) {
    const tokens = await this.listOrderAccessTokens(
      {
        ...(input?.orderId ? { order_id: input.orderId } : {}),
        ...(input?.customerEmail ? { customer_email: input.customerEmail } : {}),
        ...(input?.purpose ? { purpose: input.purpose } : {}),
      },
      {
        take: input?.limit || 50,
        order: {
          created_at: "DESC",
        },
      }
    )

    return tokens.map((token) => this.sanitizeToken(token))
  }

  private async resolveTokenByPurpose(
    token: string,
    purpose: OrderAccessPurpose
  ) {
    const tokens = await this.listOrderAccessTokens({
      token_hash: hashToken(token),
      purpose,
    })
    const match = tokens[0]

    if (!match) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Access token was not found"
      )
    }

    this.assertTokenIsActive(match)

    return this.sanitizeToken(match)
  }

  private assertTokenIsActive(token: Record<string, unknown>) {
    if (token.revoked_at) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Access token has been revoked"
      )
    }

    const expiresAt = token.expires_at
    if (expiresAt && new Date(String(expiresAt)).getTime() <= Date.now()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Access token has expired"
      )
    }

    const blockedUntil = token.blocked_until
    if (
      blockedUntil &&
      new Date(String(blockedUntil)).getTime() > Date.now()
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Access token is temporarily blocked"
      )
    }
  }

  private sanitizeToken(token: Record<string, unknown>) {
    const { token_hash: _tokenHash, ...safeToken } = token
    return safeToken
  }

  private isTokenAvailableForVerification(
    token: Record<string, unknown>,
    now: Date
  ) {
    if (token.revoked_at || token.used_at) {
      return false
    }

    if (
      token.expires_at &&
      new Date(String(token.expires_at)).getTime() <= now.getTime()
    ) {
      return false
    }

    return true
  }

  private async registerRecoveryVerificationFailure(
    candidates: Record<string, unknown>[],
    occurredAt: Date
  ) {
    const maxFailedAttempts = this.resolveRecoveryMaxFailedAttempts()
    const blockedUntil = addSeconds(
      occurredAt,
      this.resolveRecoveryBlockWindowSeconds()
    )

    for (const candidate of candidates) {
      const failedAttempts =
        Number(candidate.failed_attempts || 0) + 1
      const shouldBlock = failedAttempts >= maxFailedAttempts
      const existingBlockedUntil = candidate.blocked_until
        ? new Date(String(candidate.blocked_until))
        : null

      await this.updateOrderAccessTokens({
        id: String(candidate.id),
        failed_attempts: failedAttempts,
        last_failed_at: occurredAt,
        blocked_until: shouldBlock ? blockedUntil : existingBlockedUntil,
      })
    }
  }

  private resolveRecoveryMaxFailedAttempts() {
    const value = Number(process.env.ORDER_RECOVERY_MAX_FAILED_ATTEMPTS)
    if (Number.isFinite(value) && value >= 1) {
      return Math.floor(value)
    }

    return DEFAULT_RECOVERY_MAX_FAILED_ATTEMPTS
  }

  private resolveRecoveryBlockWindowSeconds() {
    const value = Number(process.env.ORDER_RECOVERY_BLOCK_SECONDS)
    if (Number.isFinite(value) && value >= 30) {
      return Math.floor(value)
    }

    return DEFAULT_RECOVERY_BLOCK_SECONDS
  }
}

export default GuestOrderAccessModuleService
