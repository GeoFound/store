import { SiteHeader } from "@/components/site-header"
import {
  isCustomerAccountEnabled,
  isCustomerPasswordResetEnabled,
} from "@/lib/customer-account-policy"
import { getSiteConfig } from "@/lib/site-config"
import { AccountAuthSections } from "@/sections/account"

type AccountLoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function AccountLoginPage({
  searchParams,
}: AccountLoginPageProps) {
  const params = await searchParams
  const siteConfig = getSiteConfig()
  const accountEnabled = isCustomerAccountEnabled()

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <AccountAuthSections
          siteConfig={siteConfig}
          accountEnabled={accountEnabled}
          initialError={params?.error || ""}
          passwordResetEnabled={isCustomerPasswordResetEnabled()}
        />
      </main>
    </>
  )
}
