import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolvePaymentRouterService } from "../../platform-adapters/services"
import {
  resolveEncryptionKeyRing,
  resolveSecuritySecret,
} from "../../utils/runtime-secrets"

type DependencyStatus = {
  ok: boolean
  error?: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const startedAt = Date.now()
  const dependencies: Record<string, DependencyStatus> = {
    runtime: {
      ok: false,
    },
    database: {
      ok: false,
    },
    redis: {
      ok: false,
    },
  }

  try {
    resolveSecuritySecret("JWT_SECRET")
    resolveSecuritySecret("COOKIE_SECRET")
    resolveEncryptionKeyRing("CREDENTIAL_ENCRYPTION_KEY", {
      previousNames: ["CREDENTIAL_ENCRYPTION_KEY_PREVIOUS"],
    })
    resolveEncryptionKeyRing("DELIVERY_ENCRYPTION_KEY", {
      fallbackName: "CREDENTIAL_ENCRYPTION_KEY",
      previousNames: [
        "DELIVERY_ENCRYPTION_KEY_PREVIOUS",
        "CREDENTIAL_ENCRYPTION_KEY_PREVIOUS",
      ],
    })
    dependencies.runtime.ok = true
  } catch (error) {
    dependencies.runtime.error =
      error instanceof Error ? error.message : "runtime validation failed"
  }

  try {
    const paymentRouter = resolvePaymentRouterService(req.scope)
    await paymentRouter.listPaymentChannels({}, { take: 1 })
    dependencies.database.ok = true
  } catch (error) {
    dependencies.database.error =
      error instanceof Error ? error.message : "database check failed"
  }

  try {
    const locking: ILockingModule = req.scope.resolve(Modules.LOCKING)
    await locking.execute(
      "health:redis:connectivity",
      async () => true,
      {
        timeout: 5,
      }
    )
    dependencies.redis.ok = true
  } catch (error) {
    dependencies.redis.error =
      error instanceof Error ? error.message : "redis check failed"
  }

  const ok = Object.values(dependencies).every((status) => status.ok)

  res.status(ok ? 200 : 503).json({
    ok,
    service: "backend",
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    dependencies,
  })
}
