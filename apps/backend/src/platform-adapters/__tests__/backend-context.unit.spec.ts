import { Modules } from "@medusajs/framework/utils"
import {
  createInventoryHandlerScope,
  restrictPlatformHookInput,
} from "../backend-context"
import { CREDENTIAL_INVENTORY_MODULE } from "../../modules/credential-inventory"
import { DIGITAL_DELIVERY_MODULE } from "../../modules/digital-delivery"

describe("backend capability context", () => {
  it("allows only declared inventory handler tokens", () => {
    const calls: Array<string | symbol> = []
    const scope = createInventoryHandlerScope({
      resolve<T = unknown>(token: string | symbol): T {
        calls.push(token)
        return { token } as T
      },
    })

    expect(scope.resolve(Modules.LOCKING)).toEqual({ token: Modules.LOCKING })
    expect(scope.resolve(CREDENTIAL_INVENTORY_MODULE)).toEqual({
      token: CREDENTIAL_INVENTORY_MODULE,
    })
    expect(() => scope.resolve(DIGITAL_DELIVERY_MODULE)).toThrow(
      `Backend service token "${DIGITAL_DELIVERY_MODULE}" is not allowed for inventory-handler`
    )
    expect(calls).toEqual([Modules.LOCKING, CREDENTIAL_INVENTORY_MODULE])
  })

  it("replaces hook scopes with a restricted hook scope", () => {
    const input = restrictPlatformHookInput("audit.log", {
      scope: {
        resolve<T = unknown>(token: string | symbol): T {
          return { token } as T
        },
      },
      payload: {
        ok: true,
      },
    }) as {
      scope: {
        resolve(token: string | symbol): unknown
      }
      payload: {
        ok: boolean
      }
    }

    expect(input.payload.ok).toBe(true)
    expect(input.scope.resolve(Modules.LOCKING)).toEqual({
      token: Modules.LOCKING,
    })
    expect(() => input.scope.resolve(DIGITAL_DELIVERY_MODULE)).toThrow(
      `Backend service token "${DIGITAL_DELIVERY_MODULE}" is not allowed for platform-hook`
    )
  })
})
