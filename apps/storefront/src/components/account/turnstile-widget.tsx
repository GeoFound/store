"use client"

import { useEffect, useRef } from "react"

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string
      callback(token: string): void
      "expired-callback"(): void
      "error-callback"(): void
    }
  ): string
  remove?(widgetId: string): void
  reset?(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type TurnstileWidgetProps = {
  siteKey: string
  onTokenChange(token: string): void
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script"
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

let scriptLoadPromise: Promise<void> | null = null

export function TurnstileWidget({
  siteKey,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function renderWidget() {
      await ensureTurnstileScript()

      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) {
        return
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      })
    }

    onTokenChange("")
    void renderWidget()

    return () => {
      cancelled = true

      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }

      widgetIdRef.current = null
    }
  }, [siteKey, onTokenChange])

  return <div ref={containerRef} className="min-h-[65px]" />
}

function ensureTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve()
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", reject, { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener("load", () => resolve(), { once: true })
    script.addEventListener("error", reject, { once: true })
    document.head.appendChild(script)
  })

  return scriptLoadPromise
}
