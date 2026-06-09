"use client"

import { FormEvent, useCallback, useState } from "react"
import {
  loginCustomerAccount,
  registerCustomerAccount,
  startGoogleCustomerAccountLogin,
} from "@/lib/commerce"
import {
  accountTurnstileEnabled,
  accountTurnstileSiteKey,
} from "@/lib/config"
import { TurnstileWidget } from "./turnstile-widget"

type Mode = "login" | "register"

type AccountAuthViewProps = {
  initialError?: string
}

export function AccountAuthView({ initialError = "" }: AccountAuthViewProps) {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [turnstileToken, setTurnstileToken] = useState("")
  const turnstileReady = accountTurnstileEnabled && Boolean(accountTurnstileSiteKey)
  const turnstileMisconfigured = accountTurnstileEnabled && !accountTurnstileSiteKey
  const handleTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setError("")

    try {
      if (turnstileMisconfigured) {
        throw new Error("Account challenge is not configured.")
      }

      if (turnstileReady && !turnstileToken) {
        throw new Error("Complete the security challenge.")
      }

      if (mode === "login") {
        await loginCustomerAccount({
          email,
          password,
          turnstileToken,
        })
      } else {
        await registerCustomerAccount({
          firstName,
          lastName,
          email,
          password,
          turnstileToken,
        })
      }

      window.location.href = "/account"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account request failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError("")

    try {
      const data = await startGoogleCustomerAccountLogin()

      if (!data.location) {
        throw new Error("Google login did not return a redirect URL.")
      }

      window.location.href = data.location
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google login is not available."
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form
        onSubmit={handleSubmit}
        className="theme-panel space-y-5 p-6 shadow-[var(--shadow-card)]"
      >
        <div className="theme-muted-surface grid grid-cols-2 gap-1 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`min-h-11 px-4 ${
              mode === "login" ? "theme-surface shadow-sm" : "opacity-70"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`min-h-11 px-4 ${
              mode === "register" ? "theme-surface shadow-sm" : "opacity-70"
            }`}
          >
            Create account
          </button>
        </div>

        {mode === "register" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="first-name">
                First name
              </label>
              <input
                id="first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="theme-input mt-2 w-full px-3 py-3"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="last-name">
                Last name
              </label>
              <input
                id="last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="theme-input mt-2 w-full px-3 py-3"
                autoComplete="family-name"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium" htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="theme-input mt-2 w-full px-3 py-3"
            placeholder="buyer@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="account-password">
            Password
          </label>
          <input
            id="account-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="theme-input mt-2 w-full px-3 py-3"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {turnstileReady ? (
          <TurnstileWidget
            siteKey={accountTurnstileSiteKey}
            onTokenChange={handleTurnstileTokenChange}
          />
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="theme-primary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {loading
            ? "Working..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <div className="theme-border flex items-center gap-3 border-y py-4">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs font-semibold uppercase opacity-60">
            Or
          </span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="theme-secondary-action min-h-12 w-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {googleLoading ? "Opening Google..." : "Continue with Google"}
        </button>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>

      <aside className="theme-panel h-fit p-6 text-sm leading-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold">Account access</h2>
        <div className="mt-4 space-y-4 opacity-75">
          <p>
            Guest checkout stays available. Signing in adds a private account
            center for matching orders, deliveries, and support history.
          </p>
          <p>
            Orders bought before registration can appear when their email
            matches this account.
          </p>
        </div>
      </aside>
    </div>
  )
}
