"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { formatDate } from "@/lib/format"
import {
  createCustomer as createAdminCustomer,
  loadCustomers as loadCustomerWorkspace,
} from "@/lib/product-admin-api"
import { Field, PrimaryButton, SecondaryButton, TextInput } from "./admin-controls"
import { Message, MetricCard, PageHeader, Panel } from "./admin-page"
import { AdminTable, Cell, normalizeError } from "./admin-table"

type Customer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  has_account?: boolean | null
  groups?: Array<{ id: string; name: string }>
  created_at?: string | null
  updated_at?: string | null
}

type CustomerGroup = {
  id: string
  name: string
  customers?: Customer[]
  created_at?: string | null
}

type CustomerForm = {
  email: string
  firstName: string
  lastName: string
  phone: string
}

const EMPTY_CUSTOMER_FORM: CustomerForm = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
}

async function loadCustomers(query: string) {
  return loadCustomerWorkspace(query) as Promise<{
    customers: Customer[]
    count: number
    groups: CustomerGroup[]
  }>
}

export function CustomersView() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [queryDraft, setQueryDraft] = useState("")
  const [form, setForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const customersQuery = useQuery({
    queryKey: ["customers", query],
    queryFn: () => loadCustomers(query),
  })
  const data = customersQuery.data
  const customers = data?.customers || []

  const createCustomer = useMutation({
    mutationFn: () => {
      return createAdminCustomer(form)
    },
    onSuccess: async () => {
      setMessage("客户已创建。")
      setError("")
      setForm(EMPTY_CUSTOMER_FORM)
      await queryClient.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (err) => setError(normalizeError(err)),
  })

  const update = (patch: Partial<CustomerForm>) =>
    setForm((current) => ({ ...current, ...patch }))

  return (
    <main className="px-5 py-5">
      <PageHeader
        title="客户"
        description="独立后台客户控制面，覆盖客户搜索、创建、客户组与账号状态可见性。"
        action={
          <SecondaryButton
            type="button"
            onClick={() => void customersQuery.refetch()}
          >
            刷新
          </SecondaryButton>
        }
      />

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="客户" value={customers.length} detail="当前查询" />
        <MetricCard
          label="有账号"
          value={customers.filter((customer) => customer.has_account).length}
          detail="has_account"
        />
        <MetricCard label="客户组" value={data?.groups.length || 0} detail="groups" />
        <MetricCard
          label="无组客户"
          value={customers.filter((customer) => !customer.groups?.length).length}
          detail="ungrouped"
        />
      </section>

      <div className="mb-4 grid gap-2">
        {error ? <Message tone="error">{error}</Message> : null}
        {message ? <Message tone="info">{message}</Message> : null}
        {customersQuery.error ? (
          <Message tone="error">{customersQuery.error.message}</Message>
        ) : null}
        {customersQuery.isLoading ? <Message tone="info">加载中</Message> : null}
      </div>

      <div className="grid gap-4">
        <Panel title="筛选">
          <form
            className="flex flex-col gap-3 md:flex-row md:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(queryDraft)
            }}
          >
            <div className="min-w-0 flex-1">
              <Field label="搜索">
                <TextInput
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                  placeholder="邮箱、姓名、电话"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <PrimaryButton type="submit">应用</PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setQuery("")
                  setQueryDraft("")
                }}
              >
                清空
              </SecondaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="新建客户">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage("")
              void createCustomer.mutate()
            }}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="邮箱">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(event) => update({ email: event.target.value })}
                />
              </Field>
              <Field label="名">
                <TextInput
                  value={form.firstName}
                  onChange={(event) => update({ firstName: event.target.value })}
                />
              </Field>
              <Field label="姓">
                <TextInput
                  value={form.lastName}
                  onChange={(event) => update({ lastName: event.target.value })}
                />
              </Field>
              <Field label="电话">
                <TextInput
                  value={form.phone}
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </Field>
            </div>
            <div>
              <PrimaryButton type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? "创建中" : "创建客户"}
              </PrimaryButton>
            </div>
          </form>
        </Panel>

        <Panel title="客户列表">
          <AdminTable
            headers={["客户", "账号", "客户组", "电话", "更新时间"]}
            empty={!customersQuery.isLoading && customers.length === 0}
          >
            {customers.map((customer) => (
              <tr key={customer.id} className="align-top">
                <Cell>
                  <div className="font-medium">{customer.email}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {[customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                      customer.id}
                  </div>
                </Cell>
                <Cell>{customer.has_account ? "是" : "否"}</Cell>
                <Cell>
                  {customer.groups?.map((group) => group.name).join(", ") || "-"}
                </Cell>
                <Cell>{customer.phone || "-"}</Cell>
                <Cell>{formatDate(customer.updated_at || customer.created_at)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <Panel title="客户组">
          <AdminTable
            headers={["名称", "ID", "创建"]}
            empty={!customersQuery.isLoading && (data?.groups.length || 0) === 0}
          >
            {data?.groups.map((group) => (
              <tr key={group.id} className="align-top">
                <Cell>{group.name}</Cell>
                <Cell mono>{group.id}</Cell>
                <Cell>{formatDate(group.created_at)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </main>
  )
}
