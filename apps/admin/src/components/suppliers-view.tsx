"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { adminApi } from "@/lib/admin-api"
import { formatDate } from "@/lib/format"
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel, TableShell } from "./admin-page"
import { StatusBadge } from "./status-badge"

type SupplierProvider = {
  code: string
  configured: boolean
  supports_quote: boolean
  supports_retrieve: boolean
  supports_catalog_sync: boolean
}

type SupplierMapping = {
  id: string
  product_variant_id: string
  provider_code: string
  provider_sku: string
  provider_product_id?: string | null
  region_code?: string | null
  currency?: string | null
  enabled: boolean
  priority: number
}

type SupplierProcurement = {
  id: string
  provider_code: string
  provider_order_id?: string | null
  status: string
  product_variant_id?: string | null
  order_id?: string | null
  payment_attempt_id?: string | null
  error_message?: string | null
  fulfilled_at?: string | null
  created_at?: string | null
}

async function loadSuppliers() {
  const [providerData, mappingData, procurementData] = await Promise.all([
    adminApi<{ providers: SupplierProvider[] }>("/admin/suppliers/providers"),
    adminApi<{ mappings: SupplierMapping[] }>(
      "/admin/suppliers/mappings?limit=100",
    ),
    adminApi<{ procurements: SupplierProcurement[] }>(
      "/admin/suppliers/procurements?limit=100",
    ),
  ])

  return {
    providers: providerData.providers || [],
    mappings: mappingData.mappings || [],
    procurements: procurementData.procurements || [],
  }
}

export function SuppliersView() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    productVariantId: "",
    providerCode: "reloadly",
    providerSku: "",
    providerProductId: "",
    regionCode: "",
    currency: "",
    priority: "100",
    metadata: "",
  })
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: loadSuppliers,
  })
  const data = suppliersQuery.data

  const saveMapping = useMutation({
    mutationFn: async () => {
      if (
        !form.productVariantId.trim() ||
        !form.providerCode.trim() ||
        !form.providerSku.trim()
      ) {
        throw new Error("商品变体、供应商代码和供应商 SKU 必填。")
      }

      return adminApi<{ mapping: SupplierMapping }>("/admin/suppliers/mappings", {
        method: "POST",
        body: {
          product_variant_id: form.productVariantId.trim(),
          provider_code: form.providerCode.trim(),
          provider_sku: form.providerSku.trim(),
          provider_product_id: form.providerProductId.trim() || undefined,
          region_code: form.regionCode.trim() || undefined,
          currency: form.currency.trim() || undefined,
          enabled: true,
          priority: optionalFiniteNumber(form.priority, 100),
          metadata: parseOptionalJson(form.metadata),
        },
      })
    },
    onSuccess: async (result) => {
      setMessage(`供应商映射已保存：${result.mapping.id}`)
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const retryProcurement = useMutation({
    mutationFn: (id: string) =>
      adminApi(`/admin/suppliers/procurements/${id}/retry`, {
        method: "POST",
      }),
    onSuccess: async () => {
      setMessage("采购重试已提交。")
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const configured = data?.providers.filter((provider) => provider.configured)

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="供应商"
        description="迁移后的供应商控制台。保存 mapping 和 procurement retry 都经由同源 BFF 转发。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void suppliersQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="供应商"
          value={data?.providers.length || 0}
          detail={`${configured?.length || 0} configured`}
        />
        <MetricCard label="映射" value={data?.mappings.length || 0} detail="variant mappings" />
        <MetricCard label="采购" value={data?.procurements.length || 0} detail="recent 100" />
        <MetricCard
          label="异常采购"
          value={
            data?.procurements.filter((item) =>
              ["failed", "error", "cancelled"].includes(item.status),
            ).length || 0
          }
          detail="failed / error"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {suppliersQuery.error ? (
          <Message tone="error">{suppliersQuery.error.message}</Message>
        ) : null}
        {suppliersQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="供应商状态">
          <AdminTable
            headers={["供应商", "配置", "能力"]}
            empty={!suppliersQuery.isLoading && (data?.providers.length || 0) === 0}
          >
            {data?.providers.map((provider) => (
              <tr key={provider.code} className="align-top">
                <Cell mono>{provider.code}</Cell>
                <Cell>
                  <StatusBadge
                    value={provider.configured ? "configured" : "missing"}
                  />
                </Cell>
                <Cell>
                  {[
                    provider.supports_quote ? "quote" : null,
                    provider.supports_retrieve ? "retrieve" : null,
                    provider.supports_catalog_sync ? "catalog" : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="保存商品变体映射">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void saveMapping.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="product_variant_id">
                <TextInput
                  value={form.productVariantId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      productVariantId: event.target.value,
                    }))
                  }
                  placeholder="variant_..."
                />
              </Field>
              <Field label="provider_code">
                <SelectInput
                  value={form.providerCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      providerCode: event.target.value,
                    }))
                  }
                >
                  {(data?.providers.length ? data.providers : [{ code: "reloadly" }]).map(
                    (provider) => (
                      <option key={provider.code} value={provider.code}>
                        {provider.code}
                      </option>
                    ),
                  )}
                </SelectInput>
              </Field>
              <Field label="provider_sku">
                <TextInput
                  value={form.providerSku}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      providerSku: event.target.value,
                    }))
                  }
                  placeholder="supplier sku"
                />
              </Field>
              <Field label="provider_product_id">
                <TextInput
                  value={form.providerProductId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      providerProductId: event.target.value,
                    }))
                  }
                  placeholder="optional"
                />
              </Field>
              <Field label="region_code">
                <TextInput
                  value={form.regionCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      regionCode: event.target.value,
                    }))
                  }
                  placeholder="CN"
                />
              </Field>
              <Field label="currency">
                <TextInput
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                  placeholder="cny"
                />
              </Field>
              <Field label="priority">
                <TextInput
                  inputMode="numeric"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="metadata JSON">
              <TextAreaInput
                value={form.metadata}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    metadata: event.target.value,
                  }))
                }
                placeholder='{"delivery_hint":"instant"}'
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={saveMapping.isPending}>
                保存映射
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => void suppliersQuery.refetch()}
              >
                刷新
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="现有映射">
            <AdminTable
              headers={["变体", "供应商", "SKU", "区域", "优先级", "状态"]}
              empty={!suppliersQuery.isLoading && (data?.mappings.length || 0) === 0}
            >
              {data?.mappings.map((mapping) => (
                <tr key={mapping.id} className="align-top">
                  <Cell mono>{mapping.product_variant_id}</Cell>
                  <Cell mono>{mapping.provider_code}</Cell>
                  <Cell mono>{mapping.provider_sku}</Cell>
                  <Cell>{mapping.region_code || "-"}</Cell>
                  <Cell>{mapping.priority}</Cell>
                  <Cell>
                    <StatusBadge value={mapping.enabled ? "active" : "disabled"} />
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>

          <Panel title="采购记录">
            <AdminTable
              headers={["ID", "状态", "供应商", "订单", "创建", "操作"]}
              empty={
                !suppliersQuery.isLoading &&
                (data?.procurements.length || 0) === 0
              }
            >
              {data?.procurements.map((procurement) => (
                <tr key={procurement.id} className="align-top">
                  <Cell mono>{procurement.id}</Cell>
                  <Cell>
                    <StatusBadge value={procurement.status} />
                  </Cell>
                  <Cell mono>{procurement.provider_code}</Cell>
                  <Cell mono>
                    {procurement.order_id ||
                      procurement.payment_attempt_id ||
                      procurement.provider_order_id ||
                      "-"}
                  </Cell>
                  <Cell>{formatDate(procurement.created_at)}</Cell>
                  <Cell>
                    <SecondaryButton
                      type="button"
                      disabled={
                        retryProcurement.isPending ||
                        procurement.status === "fulfilled"
                      }
                      onClick={() => {
                        setMessage("")
                        void retryProcurement.mutate(procurement.id)
                      }}
                    >
                      重试
                    </SecondaryButton>
                  </Cell>
                </tr>
              ))}
            </AdminTable>
          </Panel>
        </div>
      </div>
    </main>
  )
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

function Cell({
  children,
  mono,
}: {
  children: ReactNode
  mono?: boolean
}) {
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

function parseOptionalJson(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const parsed = JSON.parse(trimmed) as unknown

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("metadata 必须是 JSON object。")
  }

  return parsed as Record<string, unknown>
}

function optionalFiniteNumber(value: string, fallback: number) {
  if (!value.trim()) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error("priority 必须是有效数字。")
  }

  return parsed
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
