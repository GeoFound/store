import Link from "next/link"

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-normal">
          Atlas Digital
        </Link>
        <nav className="flex items-center gap-5 text-sm text-stone-700">
          <Link href="/products" className="hover:text-stone-950">
            Products
          </Link>
          <Link href="/orders" className="hover:text-stone-950">
            Orders
          </Link>
          <Link
            href="/cart"
            className="border border-stone-300 px-3 py-2 text-stone-950 hover:border-stone-950"
          >
            Cart
          </Link>
        </nav>
      </div>
    </header>
  )
}
