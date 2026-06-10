import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type OpsStatus = "ok" | "warning" | "critical" | "disabled"

type OpsSetting = {
  key: string
  label: string
  owner: string
  scope: string
  configured: boolean
  secret: boolean
  value: string | boolean | number | null
  recommended?: string | boolean | number | null
  status: OpsStatus
  notes?: string
}

type OpsFinding = {
  id: string
  severity: "info" | "warning" | "critical"
  owner: string
  title: string
  detail: string
  recommended_action: string
  human_gate: boolean
}

type OpsSection = {
  status: OpsStatus
  summary: Record<string, unknown>
  settings: OpsSetting[]
  findings: OpsFinding[]
}

type OpsAction = {
  id: string
  title: string
  risk: "low" | "medium" | "high"
  requires_human_confirmation: boolean
  available_now: boolean
  evidence_required: string[]
}

type OpsPolicySurface = {
  id: string
  title: string
  owner: string
  backend_panel_required: boolean
  production_gate_required: boolean
  human_choice_required: boolean
  admin_route: string
  control_panel_section: string
  profile_controls: string[]
  evidence_fields: string[]
  runtime_commands: string[]
  config_keys: string[]
}

type OpsPolicySection = {
  id: string
  title: string
  description: string
}

type OpsPolicyRoutePlacement = {
  route: string
  section: string
  title: string
  owner: string
  purpose: string
}

type OpsDashboard = {
  generated_at: string
  summary: {
    status: OpsStatus
    critical_findings: number
    warning_findings: number
    human_gate_actions: number
    control_panel_surface_count: number
    gated_surface_count: number
  }
  launch_readiness: OpsSection
  security: OpsSection
  maintenance: OpsSection
  customer: OpsSection
  commerce: OpsSection
  ai_ops: OpsSection
  control_panel_policy: {
    version: string
    production_control_rule: string
    information_architecture: {
      default_admin_route: string
      route_prefix: string
      section_order: OpsPolicySection[]
      route_placements: OpsPolicyRoutePlacement[]
      extension_placement_rule: string
    }
    forbidden_surface_count: number
    required_surfaces: OpsPolicySurface[]
  }
  findings: OpsFinding[]
  operator_actions: OpsAction[]
}

const EMPTY_STATE: OpsDashboard = {
  generated_at: "",
  summary: {
    status: "disabled",
    critical_findings: 0,
    warning_findings: 0,
    human_gate_actions: 0,
    control_panel_surface_count: 0,
    gated_surface_count: 0,
  },
  launch_readiness: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  security: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  maintenance: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  customer: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  commerce: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  ai_ops: {
    status: "disabled",
    summary: {},
    settings: [],
    findings: [],
  },
  control_panel_policy: {
    version: "",
    production_control_rule: "",
    information_architecture: {
      default_admin_route: "/app/control-panel",
      route_prefix: "/app",
      section_order: [],
      route_placements: [],
      extension_placement_rule: "",
    },
    forbidden_surface_count: 0,
    required_surfaces: [],
  },
  findings: [],
  operator_actions: [],
}

const OpsPage = () => {
  const { t } = useTranslation()
  const [state, setState] = useState<OpsDashboard>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(
    () => [
      {
        label: t("ops.metrics.status"),
        value: translatedStatus(t, state.summary.status),
        detail: state.generated_at || t("ops.empty.generatedAt"),
      },
      {
        label: t("ops.metrics.critical"),
        value: state.summary.critical_findings,
        detail: t("ops.metrics.criticalDetail"),
      },
      {
        label: t("ops.metrics.warnings"),
        value: state.summary.warning_findings,
        detail: t("ops.metrics.warningDetail"),
      },
      {
        label: t("ops.metrics.humanGate"),
        value: state.summary.human_gate_actions,
        detail: t("ops.metrics.humanGateDetail"),
      },
      {
        label: t("ops.metrics.surfaces"),
        value: state.summary.control_panel_surface_count,
        detail: t("ops.metrics.surfacesDetail", {
          count: state.summary.gated_surface_count,
        }),
      },
    ],
    [state, t]
  )

  async function refresh() {
    setError("")
    setLoading(true)

    try {
      setState(await adminApi<OpsDashboard>("/admin/ops-control/dashboard"))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ops.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-0">
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[780px]">
            <Heading level="h1">{t("ops.title")}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">{t("ops.description")}</Text>
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? t("ops.refreshing") : t("common.actions.refresh")}
          </Button>
        </div>
      </Container>

      <MessageBox error={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        title={t("ops.findings.title")}
        description={t("ops.findings.description")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("ops.fields.severity")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ops.fields.finding")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ops.fields.owner")}</Table.HeaderCell>
              <Table.HeaderCell>{t("ops.fields.action")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {state.findings.map((finding) => (
              <Table.Row key={finding.id}>
                <Table.Cell>
                  <Badge color={finding.severity === "critical" ? "red" : "orange"}>
                    {translatedStatus(t, finding.severity)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Heading level="h3">{finding.title}</Heading>
                  <Text className="mt-1 text-ui-fg-subtle">{finding.detail}</Text>
                  {finding.human_gate ? (
                    <Text className="mt-1 text-ui-fg-error">
                      {t("ops.findings.humanGate")}
                    </Text>
                  ) : null}
                </Table.Cell>
                <Table.Cell className="font-mono">{finding.owner}</Table.Cell>
                <Table.Cell className="max-w-[360px]">
                  <Text>{finding.recommended_action}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {state.findings.length === 0 ? (
          <Text className="text-ui-fg-subtle">{t("ops.empty.findings")}</Text>
        ) : null}
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-3">
        <SettingsSection
          title={t("ops.sections.launchReadiness")}
          section={state.launch_readiness}
        />
        <SettingsSection
          title={t("ops.sections.security")}
          section={state.security}
        />
        <SettingsSection
          title={t("ops.sections.maintenance")}
          section={state.maintenance}
        />
        <SettingsSection
          title={t("ops.sections.customer")}
          section={state.customer}
        />
        <SettingsSection
          title={t("ops.sections.commerce")}
          section={state.commerce}
        />
        <SettingsSection title={t("ops.sections.aiOps")} section={state.ai_ops} />
      </div>

      <AdminSection
        title={t("ops.policy.title")}
        description={state.control_panel_policy.production_control_rule || t("ops.policy.description")}
      >
        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          {state.control_panel_policy.information_architecture.section_order.map(
            (section) => {
              const routes =
                state.control_panel_policy.information_architecture.route_placements.filter(
                  (placement) => placement.section === section.id
                )

              return (
                <div
                  key={section.id}
                  className="flex h-full min-w-0 flex-col gap-3 rounded border border-ui-border-base p-4"
                >
                  <div>
                    <Heading level="h3">{section.title}</Heading>
                    <Text className="mt-1 text-ui-fg-subtle">
                      {section.description}
                    </Text>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {routes.map((placement) => (
                      <Badge key={placement.route}>{placement.title}</Badge>
                    ))}
                    {routes.length === 0 ? (
                      <Badge color="orange">{t("ops.policy.noRoutes")}</Badge>
                    ) : null}
                  </div>
                </div>
              )
            }
          )}
        </div>
        {state.control_panel_policy.information_architecture
          .extension_placement_rule ? (
          <Text className="mb-6 text-ui-fg-subtle">
            {
              state.control_panel_policy.information_architecture
                .extension_placement_rule
            }
          </Text>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {state.control_panel_policy.required_surfaces.map((surface) => (
            <div
              key={surface.id}
              className="flex h-full flex-col gap-3 rounded border border-ui-border-base p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Heading level="h3" className="truncate">
                    {surface.title}
                  </Heading>
                  <Text className="font-mono text-xs text-ui-fg-subtle">
                    {surface.id}
                  </Text>
                </div>
                <Badge color={surface.production_gate_required ? "red" : "orange"}>
                  {surface.production_gate_required
                    ? t("ops.policy.gated")
                    : t("ops.policy.visible")}
                </Badge>
              </div>
              <div className="grid gap-1 text-sm">
                <Text className="text-ui-fg-subtle">
                  {t("ops.fields.owner")}: {surface.owner}
                </Text>
                <Text className="text-ui-fg-subtle">
                  {t("ops.policy.adminRoute")}: {surface.admin_route}
                </Text>
                <Text className="text-ui-fg-subtle">
                  {t("ops.policy.section")}: {surface.control_panel_section}
                </Text>
              </div>
              <PolicyList
                title={t("ops.policy.evidenceFields")}
                items={surface.evidence_fields}
              />
              <PolicyList
                title={t("ops.policy.runtimeCommands")}
                items={surface.runtime_commands}
              />
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title={t("ops.actions.title")}
        description={t("ops.actions.description")}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {state.operator_actions.map((action) => (
            <div
              key={action.id}
              className="flex h-full flex-col gap-3 rounded border border-ui-border-base p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Heading level="h3">{action.title}</Heading>
                <Badge color={action.risk === "high" ? "red" : "orange"}>
                  {translatedStatus(t, action.risk)}
                </Badge>
              </div>
              <Text className="font-mono text-xs text-ui-fg-subtle">
                {action.id}
              </Text>
              <Text className="text-ui-fg-subtle">
                {action.requires_human_confirmation
                  ? t("ops.actions.requiresHuman")
                  : t("ops.actions.noHumanGate")}
              </Text>
              <ul className="list-disc space-y-1 pl-4 text-ui-fg-subtle">
                {action.evidence_required.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  )
}

function PolicyList(props: { title: string; items: string[] }) {
  if (!props.items.length) {
    return null
  }

  return (
    <div>
      <Text className="mb-1 text-ui-fg-subtle">{props.title}</Text>
      <ul className="list-disc space-y-1 pl-4 text-ui-fg-subtle">
        {props.items.map((item) => (
          <li key={item} className="font-mono text-xs">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SettingsSection(props: { title: string; section: OpsSection }) {
  const { t } = useTranslation()

  return (
    <AdminSection title={props.title}>
      <div className="mb-4 flex items-center justify-between">
        <Text className="text-ui-fg-subtle">{t("ops.fields.sectionStatus")}</Text>
        <Badge color={props.section.status === "critical" ? "red" : "green"}>
          {translatedStatus(t, props.section.status)}
        </Badge>
      </div>
      <div className="flex flex-col gap-3">
        {props.section.settings.map((setting) => (
          <div key={setting.key} className="rounded border border-ui-border-base p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Heading level="h3" className="truncate">
                  {setting.label}
                </Heading>
                <Text className="font-mono text-xs text-ui-fg-subtle">
                  {setting.key}
                </Text>
              </div>
              <Badge color={setting.status === "ok" ? "green" : "orange"}>
                {translatedStatus(t, setting.status)}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <Text>
                {t("ops.fields.current")}: {formatSettingValue(setting)}
              </Text>
              <Text className="text-ui-fg-subtle">
                {t("ops.fields.owner")}: {setting.owner}
              </Text>
              {typeof setting.recommended !== "undefined" ? (
                <Text className="text-ui-fg-subtle">
                  {t("ops.fields.recommended")}: {String(setting.recommended)}
                </Text>
              ) : null}
              {setting.notes ? (
                <Text className="text-ui-fg-subtle">{setting.notes}</Text>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </AdminSection>
  )
}

function formatSettingValue(setting: OpsSetting) {
  if (setting.secret) {
    return setting.configured ? "[configured secret]" : "[missing secret]"
  }

  if (setting.value === null || typeof setting.value === "undefined") {
    return setting.configured ? "[configured]" : "[missing]"
  }

  return String(setting.value)
}

export const config = defineRouteConfig({
  label: "adminRoutes.ops",
  translationNs: "translation",
  rank: 29,
})

export default OpsPage
