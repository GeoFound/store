import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type AIProviderConfig = {
  code: string
  label: string
  provider_kind: string
  protocol: string
  base_url: string | null
  default_model: string | null
  capabilities: string[]
  api_key_env: string | null
  api_key_configured: boolean
  requires_api_key: boolean
  enabled: boolean
  site_ids: string[]
  priority: number
  status: string
  issues: string[]
}

type AIRegisteredProvider = {
  code: string
  protocol: string | null
  configured: boolean
  supports_invoke: boolean
}

type AITaskPlugin = {
  code: string
  task_type: string
  title: string
  required_capabilities: string[]
  requires_human_review: boolean
  runnable: boolean
}

type AITaskRun = {
  id: string
  task_type: string
  plugin_code: string
  provider_code: string | null
  site_id: string | null
  status: string
  input_summary: string | null
  output_summary: string | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

type AIProvidersResponse = {
  enabled: boolean
  default_provider_code: string | null
  providers: AIProviderConfig[]
  registered_providers: AIRegisteredProvider[]
  task_plugins: AITaskPlugin[]
  task_runs: AITaskRun[]
  issues: string[]
  summary: {
    provider_count: number
    configured_provider_count: number
    attention_provider_count: number
    review_run_count: number
  }
}

type AIPolicyItem = {
  id: string
  title: string
  description: string
}

type AIPolicy = {
  version: string
  purpose: string
  admissionCriteria: AIPolicyItem[]
  requiredSurface: AIPolicyItem[]
}

const EMPTY_STATE: AIProvidersResponse = {
  enabled: false,
  default_provider_code: null,
  providers: [],
  registered_providers: [],
  task_plugins: [],
  task_runs: [],
  issues: [],
  summary: {
    provider_count: 0,
    configured_provider_count: 0,
    attention_provider_count: 0,
    review_run_count: 0,
  },
}

const EMPTY_POLICY: AIPolicy = {
  version: "1.0.0",
  purpose: "",
  admissionCriteria: [],
  requiredSurface: [],
}

const AIPage = () => {
  const { t } = useTranslation()
  const [state, setState] = useState<AIProvidersResponse>(EMPTY_STATE)
  const [policy, setPolicy] = useState<AIPolicy>(EMPTY_POLICY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(
    () => [
      {
        label: t("ai.metrics.runtime"),
        value: state.enabled ? t("status.active") : t("status.disabled"),
        detail: state.default_provider_code || t("ai.empty.defaultProvider"),
      },
      {
        label: t("ai.metrics.providers"),
        value: state.summary.provider_count,
        detail: t("ai.metrics.configuredProviders", {
          count: state.summary.configured_provider_count,
        }),
      },
      {
        label: t("ai.metrics.attention"),
        value: state.summary.attention_provider_count,
        detail: t("ai.metrics.providerIssues"),
      },
      {
        label: t("ai.metrics.review"),
        value: state.summary.review_run_count,
        detail: t("ai.metrics.reviewRuns"),
      },
    ],
    [state, t]
  )

  async function refresh() {
    setError("")
    setLoading(true)

    try {
      const [providersData, policyData] = await Promise.all([
        adminApi<AIProvidersResponse>("/admin/ai/providers"),
        adminApi<{ policy: AIPolicy }>("/admin/ai/control-panel-policy"),
      ])

      setState(providersData)
      setPolicy(policyData.policy)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-0">
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[780px]">
            <Heading level="h1">{t("ai.title")}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">{t("ai.description")}</Text>
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? t("ai.refreshing") : t("common.actions.refresh")}
          </Button>
        </div>
      </Container>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Container key={metric.label} className="p-0">
            <div className="px-5 py-4">
              <Text className="text-ui-fg-subtle">{metric.label}</Text>
              <Heading level="h2" className="mt-2">
                {metric.value}
              </Heading>
              <Text className="mt-2 text-ui-fg-subtle">{metric.detail}</Text>
            </div>
          </Container>
        ))}
      </div>

      <AdminSection
        title={t("ai.providers.title")}
        description={t("ai.providers.description")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("ai.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ai.fields.protocol")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ai.fields.endpoint")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ai.fields.model")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ai.fields.capabilities")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ai.fields.secretRef")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {state.providers.map((provider) => (
              <Table.Row key={provider.code}>
                <Table.Cell>
                  <div className="min-w-0">
                    <Heading level="h3" className="truncate">
                      {provider.label}
                    </Heading>
                    <Text className="font-mono text-xs text-ui-fg-subtle">
                      {provider.code}
                    </Text>
                    <Text className="text-xs text-ui-fg-subtle">
                      {provider.provider_kind}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell className="font-mono">{provider.protocol}</Table.Cell>
                <Table.Cell className="max-w-[260px] truncate font-mono">
                  {provider.base_url || "-"}
                </Table.Cell>
                <Table.Cell className="max-w-[220px] truncate font-mono">
                  {provider.default_model || "-"}
                </Table.Cell>
                <Table.Cell className="max-w-[260px] text-xs">
                  {provider.capabilities.length ? provider.capabilities.join(", ") : "-"}
                </Table.Cell>
                <Table.Cell>
                  <SecretReference provider={provider} />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-1">
                    <Badge>{translatedStatus(t, provider.status)}</Badge>
                    {provider.issues.slice(0, 2).map((issue) => (
                      <Text key={issue} className="max-w-[260px] truncate text-ui-fg-error">
                        {issue}
                      </Text>
                    ))}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {state.providers.length === 0 ? (
          <EmptyRow label={t("ai.empty.providers")} />
        ) : null}
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminSection
          title={t("ai.plugins.title")}
          description={t("ai.plugins.description")}
        >
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("ai.fields.plugin")}</Table.HeaderCell>
                <Table.HeaderCell>{t("ai.fields.taskType")}</Table.HeaderCell>
                <Table.HeaderCell>{t("ai.fields.capabilities")}</Table.HeaderCell>
                <Table.HeaderCell>{t("ai.fields.review")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.task_plugins.map((plugin) => (
                <Table.Row key={plugin.code}>
                  <Table.Cell>
                    <div>
                      <Heading level="h3">{plugin.title}</Heading>
                      <Text className="font-mono text-xs text-ui-fg-subtle">
                        {plugin.code}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-mono">{plugin.task_type}</Table.Cell>
                  <Table.Cell className="max-w-[220px] text-xs">
                    {plugin.required_capabilities.length
                      ? plugin.required_capabilities.join(", ")
                      : "-"}
                  </Table.Cell>
                  <Table.Cell>
                    {plugin.requires_human_review
                      ? t("ai.review.required")
                      : t("ai.review.optional")}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge>
                      {plugin.runnable ? t("status.active") : t("status.draft")}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {state.task_plugins.length === 0 ? (
            <EmptyRow label={t("ai.empty.plugins")} />
          ) : null}
        </AdminSection>

        <AdminSection
          title={t("ai.runs.title")}
          description={t("ai.runs.description")}
        >
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("ai.fields.task")}</Table.HeaderCell>
                <Table.HeaderCell>{t("ai.fields.provider")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
                <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {state.task_runs.map((run) => (
                <Table.Row key={run.id}>
                  <Table.Cell>
                    <div>
                      <Heading level="h3">{run.task_type}</Heading>
                      <Text className="font-mono text-xs text-ui-fg-subtle">
                        {run.plugin_code}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="font-mono">
                    {run.provider_code || "-"}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge>{translatedStatus(t, run.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(run.created_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {state.task_runs.length === 0 ? (
            <EmptyRow label={t("ai.empty.runs")} />
          ) : null}
        </AdminSection>
      </div>

      <AdminSection
        title={t("ai.policy.title")}
        description={t("ai.policy.description")}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <PolicyList
            title={t("ai.policy.admission")}
            items={policy.admissionCriteria}
          />
          <PolicyList
            title={t("ai.policy.surface")}
            items={policy.requiredSurface}
          />
        </div>
      </AdminSection>

      <MessageBox error={error} />
    </div>
  )
}

function SecretReference(props: { provider: AIProviderConfig }) {
  const { t } = useTranslation()
  const provider = props.provider

  if (!provider.requires_api_key) {
    return <Text className="text-ui-fg-subtle">{t("ai.secret.notRequired")}</Text>
  }

  if (!provider.api_key_env) {
    return <Text className="text-ui-fg-error">{t("ai.secret.missingRef")}</Text>
  }

  return (
    <div>
      <Text className="font-mono">{provider.api_key_env}</Text>
      <Text className="text-ui-fg-subtle">
        {provider.api_key_configured
          ? t("ai.secret.configured")
          : t("ai.secret.missing")}
      </Text>
    </div>
  )
}

function PolicyList(props: { title: string; items: AIPolicyItem[] }) {
  return (
    <div>
      <Heading level="h3">{props.title}</Heading>
      <div className="mt-3 divide-y rounded-md border border-ui-border-base">
        {props.items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <Text className="font-medium text-ui-fg-base">{item.title}</Text>
            <Text className="mt-1 text-ui-fg-subtle">{item.description}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyRow(props: { label: string }) {
  return (
    <div className="px-2 py-4">
      <Text className="text-ui-fg-subtle">{props.label}</Text>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "adminRoutes.ai",
  translationNs: "translation",
  rank: 28,
})

export default AIPage
