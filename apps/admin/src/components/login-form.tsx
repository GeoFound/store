"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting">("idle")
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("submitting")
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      router.replace("/dashboard")
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败")
    } finally {
      setStatus("idle")
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid w-full max-w-[24rem] gap-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
    >
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Store Admin</h1>
        <p className="text-sm text-[var(--muted)]">
          使用 Medusa 管理员账号登录独立控制台。
        </p>
      </div>

      <label className="grid gap-1.5 text-sm font-medium">
        邮箱
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          required
          className="h-10 border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          required
          className="h-10 border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      {error ? (
        <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-10 bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
      >
        {status === "submitting" ? "登录中" : "登录"}
      </button>
    </form>
  )
}

async function readError(response: Response) {
  const text = await response.text()

  if (!text) {
    return "登录失败"
  }

  try {
    const data = JSON.parse(text) as {
      message?: string
      error?: string
    }

    return data.message || data.error || text
  } catch {
    return text
  }
}
