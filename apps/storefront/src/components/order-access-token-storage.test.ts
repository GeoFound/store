import { afterEach, describe, expect, it, vi } from "vitest"
import {
  consumeOrderAccessTokenFromUrl,
  persistOrderAccessToken,
  readInitialOrderAccessToken,
} from "./order-access-token-storage"

const SESSION_KEY = "store_session_order_access_token"
const LEGACY_KEY = "store_last_order_access_token"

describe("order access token storage", () => {
  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.restoreAllMocks()
    window.history.replaceState({}, "", "/")
  })

  it("prefers query tokens and migrates them to session storage", () => {
    window.localStorage.setItem(LEGACY_KEY, "legacy_token")
    window.history.replaceState({}, "", "/orders?access_token=query_token")

    expect(readInitialOrderAccessToken()).toBe("query_token")
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("query_token")
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it("persists non-empty tokens only", () => {
    persistOrderAccessToken("  ")
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()

    persistOrderAccessToken(" token_1 ")
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("token_1")
  })

  it("consumes access_token from the current URL", () => {
    window.history.replaceState(
      {},
      "",
      "/orders?access_token=token_2&tab=delivery#section"
    )

    expect(consumeOrderAccessTokenFromUrl()).toBe("token_2")
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/orders?tab=delivery#section"
    )
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBe("token_2")
  })
})
