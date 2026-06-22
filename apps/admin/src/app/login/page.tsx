import { redirect } from "next/navigation"
import { getAdminAuthToken } from "@/lib/admin-auth-cookie"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage() {
  const token = await getAdminAuthToken()

  if (token) {
    redirect("/dashboard")
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <LoginForm />
    </main>
  )
}
