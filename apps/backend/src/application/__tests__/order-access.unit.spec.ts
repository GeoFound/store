import {
  createStorefrontOrderAccessApplication,
  OrderAccessApplicationError,
  type StorefrontOrderAccessRepository,
} from "../order-access"

describe("storefront order access application", () => {
  it("requests recovery codes through the neutral repository contract", async () => {
    const repository = createRepository()
    repository.retrieveOrderIdentity.mockResolvedValue({
      id: "order_1",
      email: "Buyer@Example.com",
    })
    repository.createRecoveryCode.mockResolvedValue({
      token: "123456",
      record: {
        id: "token_1",
        expires_at: new Date("2026-06-24T00:00:00.000Z"),
      },
    })
    const orderAccess = createStorefrontOrderAccessApplication(repository)

    await expect(
      orderAccess.requestRecoveryCode({
        orderId: " order_1 ",
        email: " buyer@example.com ",
        locale: "zh-CN",
        audit: {
          ipAddress: "203.0.113.10",
          userAgent: "Test Browser",
        },
      })
    ).resolves.toEqual({
      order_id: "order_1",
      expires_at: new Date("2026-06-24T00:00:00.000Z"),
    })

    expect(repository.createRecoveryCode).toHaveBeenCalledWith({
      lockKey: "order-recovery-request:order_1:buyer@example.com",
      orderId: "order_1",
      customerEmail: "Buyer@Example.com",
      metadata: {
        source: "store_order_recovery",
      },
    })
    expect(repository.emitRecoveryCodeCreated).toHaveBeenCalledWith({
      orderId: "order_1",
      customerEmail: "Buyer@Example.com",
      code: "123456",
      expiresAt: "2026-06-24T00:00:00.000Z",
      locale: "zh-CN",
    })
    expect(repository.writeAuditLog).toHaveBeenCalledWith({
      actorType: "guest",
      action: "order.recovery_requested",
      entityType: "order",
      entityId: "order_1",
      riskLevel: "medium",
      ipAddress: "203.0.113.10",
      userAgent: "Test Browser",
      metadata: {
        customer_email: "buyer@example.com",
      },
    })
  })

  it("hides order existence when the supplied email does not match", async () => {
    const repository = createRepository()
    repository.retrieveOrderIdentity.mockResolvedValue({
      id: "order_1",
      email: "buyer@example.com",
    })
    const orderAccess = createStorefrontOrderAccessApplication(repository)

    await expect(
      orderAccess.requestRecoveryCode({
        orderId: "order_1",
        email: "other@example.com",
      })
    ).rejects.toMatchObject({
      code: "order_not_found",
    })

    expect(repository.createRecoveryCode).not.toHaveBeenCalled()
  })

  it("revokes recovery codes and writes high-risk audit when notification fails", async () => {
    const repository = createRepository()
    repository.retrieveOrderIdentity.mockResolvedValue({
      id: "order_1",
      email: "buyer@example.com",
    })
    repository.createRecoveryCode.mockResolvedValue({
      token: "123456",
      record: {
        id: "token_1",
        expires_at: "2026-06-24T00:00:00.000Z",
      },
    })
    repository.emitRecoveryCodeCreated.mockRejectedValue(
      new Error("mail service unavailable")
    )
    const orderAccess = createStorefrontOrderAccessApplication(repository)

    await expect(
      orderAccess.requestRecoveryCode({
        orderId: "order_1",
        email: "buyer@example.com",
        audit: {
          ipAddress: "203.0.113.10",
          userAgent: "Test Browser",
        },
      })
    ).rejects.toMatchObject({
      code: "recovery_notification_failed",
    })

    expect(repository.revokeRecoveryCode).toHaveBeenCalledWith("token_1")
    expect(repository.writeAuditLog).toHaveBeenCalledWith({
      actorType: "system",
      action: "order.recovery_notification_failed",
      entityType: "order",
      entityId: "order_1",
      riskLevel: "high",
      ipAddress: "203.0.113.10",
      userAgent: "Test Browser",
      metadata: {
        customer_email: "buyer@example.com",
        recovery_token_id: "token_1",
        error: "mail service unavailable",
      },
    })
  })

  it("surfaces recovery cooldown as an application error", async () => {
    const repository = createRepository()
    repository.retrieveOrderIdentity.mockResolvedValue({
      id: "order_1",
      email: "buyer@example.com",
    })
    repository.createRecoveryCode.mockRejectedValue(
      new OrderAccessApplicationError(
        "recovery_cooldown",
        "Recovery code was recently issued."
      )
    )
    const orderAccess = createStorefrontOrderAccessApplication(repository)

    await expect(
      orderAccess.requestRecoveryCode({
        orderId: "order_1",
        email: "buyer@example.com",
      })
    ).rejects.toMatchObject({
      code: "recovery_cooldown",
    })
  })

  it("verifies recovery codes and emits token-issued events", async () => {
    const repository = createRepository()
    repository.retrieveOrderIdentity.mockResolvedValue({
      id: "order_1",
      email: "Buyer@Example.com",
    })
    repository.verifyRecoveryCodeAndIssueViewToken.mockResolvedValue({
      token: "ord_123",
    })
    const orderAccess = createStorefrontOrderAccessApplication(repository)

    await expect(
      orderAccess.verifyRecoveryCode({
        orderId: " order_1 ",
        code: " 123456 ",
        audit: {
          ipAddress: "203.0.113.10",
          userAgent: "Test Browser",
        },
      })
    ).resolves.toEqual({
      order_id: "order_1",
      access_token: "ord_123",
    })

    expect(repository.verifyRecoveryCodeAndIssueViewToken).toHaveBeenCalledWith({
      lockKey: "order-recovery:order_1:buyer@example.com",
      orderId: "order_1",
      customerEmail: "Buyer@Example.com",
      code: "123456",
      metadata: {
        source: "store_order_recovery_verify",
      },
    })
    expect(repository.emitOrderAccessTokenIssued).toHaveBeenCalledWith({
      orderId: "order_1",
      customerEmail: "Buyer@Example.com",
      purpose: "view_order",
      source: "store_order_recovery_verify",
      actorType: "guest",
      ipAddress: "203.0.113.10",
      userAgent: "Test Browser",
      metadata: {
        recovery_code_verified: true,
      },
    })
  })
})

function createRepository() {
  return {
    isGuestOrderAccessAvailable: jest.fn(() => true),
    retrieveOrderIdentity: jest.fn(),
    createRecoveryCode: jest.fn(),
    revokeRecoveryCode: jest.fn(),
    emitRecoveryCodeCreated: jest.fn(),
    verifyRecoveryCodeAndIssueViewToken: jest.fn(),
    emitOrderAccessTokenIssued: jest.fn(),
    writeAuditLog: jest.fn(),
  } satisfies jest.Mocked<StorefrontOrderAccessRepository>
}
