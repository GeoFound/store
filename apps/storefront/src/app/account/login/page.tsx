import Link from "next/link"
import { AccountAuthView } from "@/components/account/account-auth-view"
import { SiteHeader } from "@/components/site-header"

type AccountLoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function AccountLoginPage({
  searchParams,
}: AccountLoginPageProps) {
  const params = await searchParams

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold leading-tight">
                Customer account
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                Sign in for a private view of your orders, deliveries, and
                support requests.
              </p>
            </div>
            <Link
              href="/checkout"
              className="theme-secondary-action inline-flex min-h-11 items-center px-4 text-sm font-semibold"
            >
              Continue as guest
            </Link>
          </div>
          <AccountAuthView initialError={params?.error || ""} />
        </div>
      </main>
    </>
  )
}
