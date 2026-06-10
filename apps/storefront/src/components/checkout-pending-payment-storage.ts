import type { ManualPaymentInstructions } from "@/lib/types"

const PENDING_PAYMENT_ATTEMPT_ID_KEY = "store_pending_payment_attempt_id"
const PENDING_PAYMENT_CLAIM_TOKEN_KEY = "store_pending_payment_claim_token"
const PENDING_PAYMENT_INSTRUCTIONS_KEY = "store_pending_payment_instructions"
const PENDING_PAYMENT_STORAGE_VERSION_KEY = "store_pending_payment_storage_version"
const PENDING_PAYMENT_STORAGE_VERSION = "session-v1"

export type PendingPaymentState = {
  attemptId: string
  claimToken: string
  instructions: string
}

export function persistPendingPaymentState(
  attemptId: string,
  claimToken: string,
  instructions: ManualPaymentInstructions | null
) {
  window.sessionStorage.setItem(
    PENDING_PAYMENT_STORAGE_VERSION_KEY,
    PENDING_PAYMENT_STORAGE_VERSION
  )
  window.sessionStorage.setItem(PENDING_PAYMENT_ATTEMPT_ID_KEY, attemptId)
  window.sessionStorage.setItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY, claimToken)

  if (instructions) {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_INSTRUCTIONS_KEY,
      JSON.stringify(instructions)
    )
  } else {
    window.sessionStorage.removeItem(PENDING_PAYMENT_INSTRUCTIONS_KEY)
  }

  clearLegacyPendingPaymentState()
}

export function clearPendingPaymentState() {
  window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_VERSION_KEY)
  window.sessionStorage.removeItem(PENDING_PAYMENT_ATTEMPT_ID_KEY)
  window.sessionStorage.removeItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY)
  window.sessionStorage.removeItem(PENDING_PAYMENT_INSTRUCTIONS_KEY)
  clearLegacyPendingPaymentState()
}

export function readPendingPaymentState(): PendingPaymentState {
  const attemptId =
    window.sessionStorage.getItem(PENDING_PAYMENT_ATTEMPT_ID_KEY) ||
    window.localStorage.getItem(PENDING_PAYMENT_ATTEMPT_ID_KEY) ||
    ""
  const claimToken =
    window.sessionStorage.getItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY) ||
    window.localStorage.getItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY) ||
    ""
  const instructions =
    window.sessionStorage.getItem(PENDING_PAYMENT_INSTRUCTIONS_KEY) ||
    window.localStorage.getItem(PENDING_PAYMENT_INSTRUCTIONS_KEY) ||
    ""

  migrateLegacyPendingPaymentState({
    attemptId,
    claimToken,
    instructions,
  })

  return {
    attemptId,
    claimToken,
    instructions,
  }
}

function migrateLegacyPendingPaymentState(state: PendingPaymentState) {
  const hasLegacyState =
    window.localStorage.getItem(PENDING_PAYMENT_ATTEMPT_ID_KEY) ||
    window.localStorage.getItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY) ||
    window.localStorage.getItem(PENDING_PAYMENT_INSTRUCTIONS_KEY)

  if (!hasLegacyState) {
    return
  }

  if (state.attemptId) {
    window.sessionStorage.setItem(PENDING_PAYMENT_ATTEMPT_ID_KEY, state.attemptId)
  }

  if (state.claimToken) {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_CLAIM_TOKEN_KEY,
      state.claimToken
    )
  }

  if (state.instructions) {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_INSTRUCTIONS_KEY,
      state.instructions
    )
  }

  clearLegacyPendingPaymentState()
}

function clearLegacyPendingPaymentState() {
  window.localStorage.removeItem(PENDING_PAYMENT_ATTEMPT_ID_KEY)
  window.localStorage.removeItem(PENDING_PAYMENT_CLAIM_TOKEN_KEY)
  window.localStorage.removeItem(PENDING_PAYMENT_INSTRUCTIONS_KEY)
}
