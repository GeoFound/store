"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import { loadProductPublishingWorkspace } from "@/lib/product-admin-api"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { SecondaryButton } from "./admin-controls"
import { StatusBadge } from "./status-badge"

type ProductTemplate = {
  code: string
  title: string
  description: string
  productType: string
  fulfillmentPolicyCode?: string
  deliveryHandlerCode?: string
  inventoryHandlerCode?: string
}

type CatalogVariant = {
  id: string
  title: string | null
  sku: string | null
  product_id: string | null
  product_title: string | null
  product_handle: string | null
  template_code: string
  template_title: string
  inventory_handler_code: string
  delivery_handler_code: string | null
  credential_inventory_supported: boolean
  total_count: number | null
  available_count: number | null
  reserved_count: number | null
  sold_count: number | null
}

type ReadinessState = "ready" | "needs_stock" | "external" | "manual" | "unknown"

async function loadPublishing() {
  return loadProductPublishingWorkspace() as Promise<{
    templates: ProductTemplate[]
    variants: CatalogVariant[]
  }>
}

export function ProductPublishingView() {
  const publishingQuery = useQuery({
    queryKey: ["product-publishing"],
    queryFn: loadPublishing,
  })
  const data = publishingQuery.data
  const variants = useMemo(() => data?.variants || [], [data])
  const templates = data?.templates || []

  const summary = useMemo(
    () =>
      variants.reduce(
        (current, variant) => {
          current.total += 1
          current[readinessState(variant)] += 1
          return current
        },
        {
          external: 0,
          manual: 0,
          needs_stock: 0,
          ready: 0,
          total: 0,
          unknown: 0,
        } as Record<ReadinessState | "total", number>,
      ),
    [variants],
  )

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="商品发布"
        description="按模板、库存处理器和交付处理器总览可售变体；商品创建与状态管理已迁移到独立后台商品页。"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/products"
              className="min-h-9 bg-[var(--accent)] px-3 text-sm font-semibold leading-9 text-white hover:bg-[var(--accent-strong)]"
            >
              新建商品
            </Link>
            <SecondaryButton
              type="button"
              onClick={() => void publishingQuery.refetch()}
            >
              刷新
            </SecondaryButton>
          </div>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="变体总数" value={summary.total} detail="variants" />
        <MetricCard label="就绪" value={summary.ready} detail="ready" />
        <MetricCard label="待补货" value={summary.needs_stock} detail="needs stock" />
        <MetricCard
          label="外部 / 其它"
          value={summary.external + summary.manual + summary.unknown}
          detail="external / manual"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {publishingQuery.error ? (
          <Message tone="error">{publishingQuery.error.message}</Message>
        ) : null}
        {publishingQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="变体就绪状态">
          <AdminTable
            headers={["变体", "模板", "处理器", "库存", "状态", "操作"]}
            empty={!publishingQuery.isLoading && variants.length === 0}
          >
            {variants.map((variant) => {
              const state = readinessState(variant)

              return (
                <tr key={variant.id} className="align-top">
                  <Cell>
                    <div className="font-medium">
                      {variant.product_title || variant.product_handle || "-"}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {variant.title || variant.sku || variant.id}
                    </div>
                  </Cell>
                  <Cell>
                    <div>{variant.template_title}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {variant.template_code}
                    </div>
                  </Cell>
                  <Cell mono>
                    {variant.inventory_handler_code} /{" "}
                    {variant.delivery_handler_code || "-"}
                  </Cell>
                  <Cell>{stockLabel(variant)}</Cell>
                  <Cell>
                    <StatusBadge value={state} />
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {variant.product_id ? (
                        <Link
                          href={`/dashboard/products?product_id=${variant.product_id}`}
                          className="min-h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium leading-9 hover:bg-[var(--surface-muted)]"
                        >
                          打开商品
                        </Link>
                      ) : null}
                      {variant.credential_inventory_supported ? (
                        <LinkButton href="/dashboard/credentials">补货</LinkButton>
                      ) : variant.delivery_handler_code ===
                        "supplier-procurement" ? (
                        <LinkButton href="/dashboard/suppliers">映射</LinkButton>
                      ) : null}
                    </div>
                  </Cell>
                </tr>
              )
            })}
          </AdminTable>
        </Panel>

        <Panel title="商品模板">
          <AdminTable
            headers={["模板", "类型", "履约", "库存处理器", "交付处理器"]}
            empty={!publishingQuery.isLoading && templates.length === 0}
          >
            {templates.map((template) => (
              <tr key={template.code} className="align-top">
                <Cell>
                  <div className="font-medium">{template.title}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {template.code}
                  </div>
                </Cell>
                <Cell>{template.productType}</Cell>
                <Cell>{template.fulfillmentPolicyCode || "-"}</Cell>
                <Cell>{template.inventoryHandlerCode || "-"}</Cell>
                <Cell>{template.deliveryHandlerCode || "-"}</Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="min-h-9 border border-[var(--border)] bg-white px-3 text-sm font-medium leading-9 hover:bg-[var(--surface-muted)]"
    >
      {children}
    </Link>
  )
}

function readinessState(variant: CatalogVariant): ReadinessState {
  if (variant.credential_inventory_supported) {
    return (variant.available_count || 0) > 0 ? "ready" : "needs_stock"
  }

  if (variant.delivery_handler_code === "supplier-procurement") {
    return "external"
  }

  if (variant.delivery_handler_code === "manual") {
    return "manual"
  }

  return "unknown"
}

function stockLabel(variant: CatalogVariant) {
  if (!variant.credential_inventory_supported) {
    return "非库存支撑"
  }

  return `可用 ${variant.available_count ?? 0} / 预留 ${variant.reserved_count ?? 0} / 已售 ${variant.sold_count ?? 0} / 总 ${variant.total_count ?? 0}`
}

function AdminTable({
  headers,
  empty,
  children,
}: {
  headers: string[]
  empty: boolean
  children: ReactNode
}) {
  return (
    <>
      <TableShell>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-[var(--border)] py-2 pr-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </TableShell>
      {empty ? <Message tone="info">暂无数据</Message> : null}
    </>
  )
}

function Cell({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={
        mono
          ? "border-b border-[var(--border)] py-3 pr-4 font-mono text-xs"
          : "border-b border-[var(--border)] py-3 pr-4"
      }
    >
      {children}
    </td>
  )
}
