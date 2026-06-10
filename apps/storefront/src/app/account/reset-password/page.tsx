import { AccountPasswordResetView } from "@/components/account/account-password-reset-view"
import { SiteHeader } from "@/components/site-header"
import { isCustomerPasswordResetEnabled } from "@/lib/customer-account-policy"

type AccountResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string
  }>
}

export default async function AccountResetPasswordPage({
  searchParams,
}: AccountResetPasswordPageProps) {
  const params = await searchParams

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <AccountPasswordResetView
            enabled={isCustomerPasswordResetEnabled()}
            token={params?.token || ""}
          />
        </div>
      </main>
    </>
  )
}
