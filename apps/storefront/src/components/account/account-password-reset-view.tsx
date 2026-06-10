"use client"

import Link from "next/link"
import { FormEvent, useCallback, useState } from "react"
import {
  confirmCustomerAccountPasswordReset,
  requestCustomerAccountPasswordReset,
} from "@/lib/commerce"
import {
  accountTurnstileEnabled,
  accountTurnstileSiteKey,
} from "@/lib/config"
import { TurnstileWidget } from "./turnstile-widget"

type AccountPasswordResetViewProps = {
  enabled: boolean
  token?: string
}

export function AccountPasswordResetView({
  enabled,
  token = "",
}: AccountPasswordResetViewProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const turnstileReady = accountTurnstileEnabled && Boolean(accountTurnstileSiteKey)
  const turnstileMisconfigured = accountTurnstileEnabled && !accountTurnstileSiteKey
  const handleTurnstileTokenChange = useCallback((value: string) => {
    setTurnstileToken(value)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!enabled) {
      setError("Customer password reset is not enabled.")
      return
    }

    setLoading(true)
    setError("")

    try {
      if (token) {
        if (password !== repeatPassword) {
          throw new Error("Passwords do not match.")
        }

        await confirmCustomerAccountPasswordReset({
          token,
          password,
        })
      } else {
        if (turnstileMisconfigured) {
          throw new Error("Account challenge is not configured.")
        }

        if (turnstileReady && !turnstileToken) {
          throw new Error("Complete the security challenge.")
        }

        await requestCustomerAccountPasswordReset({
          email,
          turnstileToken,
        })
      }

      setDone(true)
      setPassword("")
      setRepeatPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.")
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) {
    return (
      <div className="theme-panel p-8">
        <h1 className="text-4xl font-semibold leading-tight">Account recovery</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 opacity-70">
          Account password reset is disabled. Guest order recovery remains
          available.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/orders"
            className="theme-primary-action inline-flex min-h-12 items-center px-5 text-sm font-semibold"
          >
            Recover order
          </Link>
          <Link
            href="/"
            className="theme-secondary-action inline-flex min-h-12 items-center px-5 text-sm font-semibold"
          >
            Store home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="theme-panel mx-auto max-w-xl space-y-5 p-6 shadow-[var(--shadow-card)]"
    >
      <div>
        <h1 className="text-3xl font-semibold leading-tight">
          {token ? "Choose a new password" : "Reset password"}
        </h1>
        <p className="mt-2 text-sm leading-6 opacity-70">
          {token
            ? "Enter a new password for this customer account."
            : "Enter the email used for your customer account."}
        </p>
      </div>

      {token ? (
        <>
          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="account-new-password"
            >
              New password
            </label>
            <input
              id="account-new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="theme-input mt-2 w-full px-3 py-3"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="account-repeat-password"
            >
              Repeat password
            </label>
            <input
              id="account-repeat-password"
              type="password"
              required
              minLength={8}
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              className="theme-input mt-2 w-full px-3 py-3"
              autoComplete="new-password"
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium" htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="theme-input mt-2 w-full px-3 py-3"
              placeholder="buyer@example.com"
              autoComplete="email"
            />
          </div>

          {turnstileReady ? (
            <TurnstileWidget
              siteKey={accountTurnstileSiteKey}
              onTokenChange={handleTurnstileTokenChange}
            />
          ) : null}
        </>
      )}

      <button
        type="submit"
        disabled={loading || done}
        className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Working..." : token ? "Save password" : "Send reset link"}
      </button>

      {done ? (
        <p className="text-sm text-[var(--success)]">
          {token
            ? "Password updated. You can sign in now."
            : "If the account exists, reset instructions will be sent."}
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="pt-2">
        <Link href="/account/login" className="text-sm font-semibold underline">
          Back to sign in
        </Link>
      </div>
    </form>
  )
}
