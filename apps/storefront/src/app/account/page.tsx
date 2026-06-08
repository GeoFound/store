import Link from "next/link"
import { AccountLogoutButton } from "@/components/account/account-logout-button"
import { SiteHeader } from "@/components/site-header"
import {
  getCustomerAuthToken,
  listCustomerAccountOrders,
  retrieveCustomerAccount,
} from "@/lib/account-server"
import { formatMoney } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const token = await getCustomerAuthToken()

  if (!token) {
    return <SignedOutAccount />
  }

  const accountData = await loadAccountData(token).catch(() => null)

  if (!accountData) {
    return <SignedOutAccount />
  }

  const { customer, orders } = accountData
  const customerName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold leading-tight">
                Account center
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                {customerName || customer.email}
              </p>
            </div>
            <AccountLogoutButton />
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="theme-panel p-5">
              <div className="text-sm font-semibold opacity-60">Email</div>
              <div className="mt-2 break-all text-lg font-semibold">
                {customer.email}
              </div>
            </div>
            <div className="theme-panel p-5">
              <div className="text-sm font-semibold opacity-60">Orders</div>
              <div className="mt-2 text-lg font-semibold">{orders.length}</div>
            </div>
            <div className="theme-panel p-5">
              <div className="text-sm font-semibold opacity-60">Access</div>
              <div className="mt-2 text-lg font-semibold">Customer</div>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Orders</h2>
                <p className="mt-2 text-sm leading-6 opacity-70">
                  Includes orders from this customer account and matching
                  guest-checkout email.
                </p>
              </div>
              <Link
                href="/orders"
                className="theme-secondary-action hidden min-h-11 items-center px-4 text-sm font-semibold sm:inline-flex"
              >
                Recover order
              </Link>
            </div>

            {orders.length ? (
              <div className="theme-panel overflow-hidden">
                <div className="grid gap-0 divide-y divide-[var(--border)]">
                  {orders.map(({ order, access_token }) => (
                    <article
                      key={order.id}
                      className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_auto] md:items-center"
                    >
                      <div>
                        <div className="font-semibold">
                          #{order.display_id || order.custom_display_id || order.id}
                        </div>
                        <div className="mt-1 text-sm opacity-70">
                          {formatDate(order.created_at)} · {order.status}
                        </div>
                      </div>
                      <div className="text-sm leading-6 opacity-75">
                        {(order.items || []).slice(0, 2).map((item) => (
                          <div key={item.id}>
                            {item.title} x {item.quantity}
                          </div>
                        ))}
                        {(order.items || []).length > 2 ? (
                          <div>+{(order.items || []).length - 2} more</div>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-4 md:justify-end">
                        <span className="font-semibold">
                          {formatMoney(order.total, order.currency_code)}
                        </span>
                        <Link
                          href={`/orders?access_token=${encodeURIComponent(access_token)}`}
                          className="theme-primary-action inline-flex min-h-11 items-center px-4 text-sm font-semibold"
                        >
                          Open
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="theme-panel p-6">
                <h3 className="text-lg font-semibold">No orders yet</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                  Orders placed with this account email will appear here after
                  payment confirmation.
                </p>
                <Link
                  href="/products"
                  className="theme-primary-action mt-5 inline-flex min-h-11 items-center px-4 text-sm font-semibold"
                >
                  Browse products
                </Link>
              </div>
            )}
          </section>
        </div>
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

function SignedOutAccount() {
  return (
    <>
      <SiteHeader />
      <main className="theme-subtle-grid flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="theme-panel p-8">
            <h1 className="text-4xl font-semibold leading-tight">
              Account center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 opacity-70">
              Sign in to see customer orders and deliveries. Guest order access
              remains available without an account.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/account/login"
                className="theme-primary-action inline-flex min-h-12 items-center px-5 text-sm font-semibold"
              >
                Sign in
              </Link>
              <Link
                href="/orders"
                className="theme-secondary-action inline-flex min-h-12 items-center px-5 text-sm font-semibold"
              >
                Recover order
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value))
}
