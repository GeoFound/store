"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { formatDate } from "@/lib/format"
import {
  loadSupplierWorkspace,
  retrySupplierProcurement,
  saveSupplierMapping,
} from "@/lib/product-admin-api"
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
    queryFn: loadSupplierWorkspace,
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

      return saveSupplierMapping(form)
    },
    onSuccess: async (result) => {
      setMessage(`供应商映射已保存：${result.mapping.id}`)
      setError("")
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const retryProcurement = useMutation({
    mutationFn: (id: string) => retrySupplierProcurement(id),
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
                    provider.supportsQuote ? "quote" : null,
                    provider.supportsRetrieve ? "retrieve" : null,
                    provider.supportsCatalogSync ? "catalog" : null,
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
              <Field label="商品变体 ID">
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
              <Field label="供应商代码">
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
              <Field label="供应商 SKU">
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
              <Field label="供应商商品 ID">
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
              <Field label="区域代码">
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
                placeholder='{"deliveryHint":"instant"}'
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
                  <Cell mono>{mapping.productVariantId}</Cell>
                  <Cell mono>{mapping.providerCode}</Cell>
                  <Cell mono>{mapping.providerSku}</Cell>
                  <Cell>{mapping.regionCode || "-"}</Cell>
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
                  <Cell mono>{procurement.providerCode}</Cell>
                  <Cell mono>
                    {procurement.orderId ||
                      procurement.paymentAttemptId ||
                      procurement.providerOrderId ||
                      "-"}
                  </Cell>
                  <Cell>{formatDate(procurement.createdAt)}</Cell>
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。"
}
