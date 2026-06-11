import { SiteHeader } from "@/components/site-header"
import { isCustomerPasswordResetEnabled } from "@/lib/customer-account-policy"
import { getSiteConfig } from "@/lib/site-config"
import { AccountPasswordResetSections } from "@/sections/account"

type AccountResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string
  }>
}

export default async function AccountResetPasswordPage({
  searchParams,
}: AccountResetPasswordPageProps) {
  const params = await searchParams
  const siteConfig = getSiteConfig()

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <AccountPasswordResetSections
          siteConfig={siteConfig}
          enabled={isCustomerPasswordResetEnabled()}
          token={params?.token || ""}
        />
      </main>
    </>
  )
}
