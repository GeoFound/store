import { SiteHeader } from "@/components/site-header"
import {
  getCustomerAuthToken,
  listCustomerAccountOrders,
  retrieveCustomerAccount,
} from "@/lib/account-server"
import { isCustomerAccountEnabled } from "@/lib/customer-account-policy"
import { getSiteConfig } from "@/lib/site-config"
import { AccountSections } from "@/sections/account"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const siteConfig = getSiteConfig()

  if (!isCustomerAccountEnabled()) {
    return (
      <>
        <SiteHeader />
        <main className="theme-subtle-grid flex-1">
          <AccountSections siteConfig={siteConfig} state={{ kind: "disabled" }} />
        </main>
      </>
    )
  }

  const token = await getCustomerAuthToken()

  if (!token) {
    return (
      <>
        <SiteHeader />
        <main className="theme-subtle-grid flex-1">
          <AccountSections siteConfig={siteConfig} state={{ kind: "signed-out" }} />
        </main>
      </>
    )
  }

  const accountData = await loadAccountData(token).catch(() => null)

  if (!accountData) {
    return (
      <>
        <SiteHeader />
        <main className="theme-subtle-grid flex-1">
          <AccountSections siteConfig={siteConfig} state={{ kind: "signed-out" }} />
        </main>
      </>
    )
  }

  const { customer, orders } = accountData

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <AccountSections
          siteConfig={siteConfig}
          state={{ kind: "signed-in", customer, orders }}
        />
      </main>
    </>
  )
}

async function loadAccountData(token: string) {
  const [customer, orders] = await Promise.all([
    retrieveCustomerAccount(token),
    listCustomerAccountOrders(token),
  ])

  return { customer, orders }
}
