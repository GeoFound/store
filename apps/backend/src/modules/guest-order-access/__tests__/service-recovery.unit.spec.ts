import GuestOrderAccessModuleService from "../service"
import { hashToken } from "../../../utils/token"

type TokenRecord = Record<string, unknown>

describe("guest order access recovery verification", () => {
  const originalMax = process.env.ORDER_RECOVERY_MAX_FAILED_ATTEMPTS
  const originalBlock = process.env.ORDER_RECOVERY_BLOCK_SECONDS

  beforeEach(() => {
    process.env.ORDER_RECOVERY_MAX_FAILED_ATTEMPTS = "2"
    process.env.ORDER_RECOVERY_BLOCK_SECONDS = "60"
  })

  afterEach(() => {
    process.env.ORDER_RECOVERY_MAX_FAILED_ATTEMPTS = originalMax
    process.env.ORDER_RECOVERY_BLOCK_SECONDS = originalBlock
  })

  it("increments failed attempts and blocks after threshold", async () => {
    const token = buildToken({
      token_hash: hashToken("123456"),
      failed_attempts: 1,
    })
    const service = createService([token])

    await expect(
      service.verifyRecoveryCode({
        orderId: "order_1",
        customerEmail: "buyer@example.com",
        code: "000000",
      })
    ).rejects.toThrow("Recovery code is invalid")

    expect(service.updateOrderAccessTokens).toHaveBeenCalledTimes(1)
    const updatePayload = service.updateOrderAccessTokens.mock.calls[0][0]
    expect(updatePayload.failed_attempts).toBe(2)
    expect(updatePayload.blocked_until).toBeInstanceOf(Date)
  })

  it("rejects blocked codes before matching", async () => {
    const token = buildToken({
      token_hash: hashToken("123456"),
      blocked_until: new Date(Date.now() + 60_000).toISOString(),
    })
    const service = createService([token])

    await expect(
      service.verifyRecoveryCode({
        orderId: "order_1",
        customerEmail: "buyer@example.com",
        code: "123456",
      })
    ).rejects.toThrow("Too many invalid recovery attempts")

    expect(service.updateOrderAccessTokens).not.toHaveBeenCalled()
  })

  it("marks recovery code used when matched", async () => {
    const token = buildToken({
      token_hash: hashToken("123456"),
      failed_attempts: 1,
    })
    const service = createService([token])

    const result = await service.verifyRecoveryCode({
      orderId: "order_1",
      customerEmail: "buyer@example.com",
      code: "123456",
    })

    expect(result.id).toBe(token.id)
    expect(result.used_at).toBeTruthy()
    expect("token_hash" in result).toBe(false)
    expect(service.updateOrderAccessTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        id: token.id,
        failed_attempts: 0,
        blocked_until: null,
      })
    )
  })
})

describe("guest order access recovery issuance", () => {
  const originalCooldown = process.env.ORDER_RECOVERY_REQUEST_COOLDOWN_SECONDS

  beforeEach(() => {
    process.env.ORDER_RECOVERY_REQUEST_COOLDOWN_SECONDS = "60"
  })

  afterEach(() => {
    process.env.ORDER_RECOVERY_REQUEST_COOLDOWN_SECONDS = originalCooldown
  })

  it("blocks issuance when a recovery code was just created", async () => {
    const service = createRecoveryIssuanceService([
      buildToken({
        created_at: new Date(Date.now() - 30_000).toISOString(),
      }),
    ])

    await expect(
      service.createRecoveryCode({
        orderId: "order_1",
        customerEmail: "buyer@example.com",
      })
    ).rejects.toThrow("recently issued")

    expect(service.issueOrderAccessToken).not.toHaveBeenCalled()
  })

  it("allows issuance after cooldown window", async () => {
    const service = createRecoveryIssuanceService([
      buildToken({
        created_at: new Date(Date.now() - 120_000).toISOString(),
      }),
    ])

    await service.createRecoveryCode({
      orderId: "order_1",
      customerEmail: "buyer@example.com",
    })

    expect(service.issueOrderAccessToken).toHaveBeenCalledTimes(1)
  })

  it("ignores revoked recovery codes when enforcing issuance cooldown", async () => {
    const service = createRecoveryIssuanceService([
      buildToken({
        created_at: new Date(Date.now() - 30_000).toISOString(),
        revoked_at: new Date().toISOString(),
      }),
    ])

    await service.createRecoveryCode({
      orderId: "order_1",
      customerEmail: "buyer@example.com",
    })

    expect(service.issueOrderAccessToken).toHaveBeenCalledTimes(1)
  })
})

function createService(tokens: TokenRecord[]) {
  const service = Object.create(
    GuestOrderAccessModuleService.prototype
  ) as GuestOrderAccessModuleService & {
    listOrderAccessTokens: jest.Mock<any, any>
    updateOrderAccessTokens: jest.Mock<any, any>
  }
  const tokenById = new Map(tokens.map((token) => [String(token.id), { ...token }]))

  service.listOrderAccessTokens = jest.fn(async () =>
    Array.from(tokenById.values())
  ) as jest.Mock<any, any>
  service.updateOrderAccessTokens = jest.fn(async (input: TokenRecord) => {
    const existing = tokenById.get(String(input.id))
    const updated: TokenRecord = {
      ...(existing || {}),
      ...input,
    }
    tokenById.set(String(updated.id), updated)
    return updated
  }) as jest.Mock<any, any>

  return service
}

function buildToken(overrides?: Partial<TokenRecord>): TokenRecord {
  return {
    id: "tok_1",
    order_id: "order_1",
    customer_email: "buyer@example.com",
    purpose: "claim_order",
    token_hash: hashToken("654321"),
    token_hint: "654321",
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    used_at: null,
    revoked_at: null,
    failed_attempts: 0,
    last_failed_at: null,
    blocked_until: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createRecoveryIssuanceService(tokens: TokenRecord[]) {
  const service = Object.create(
    GuestOrderAccessModuleService.prototype
  ) as GuestOrderAccessModuleService & {
    listOrderAccessTokens: jest.Mock<any, any>
    issueOrderAccessToken: jest.Mock<any, any>
  }

  service.listOrderAccessTokens = jest.fn(async () => tokens) as jest.Mock<any, any>
  service.issueOrderAccessToken = jest.fn(async () => ({
    token: "123456",
    record: buildToken({
      id: "tok_new",
      token_hash: hashToken("123456"),
    }),
  })) as jest.Mock<any, any>

  return service
}
