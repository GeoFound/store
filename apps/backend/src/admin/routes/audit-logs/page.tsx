import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Input, Table, Text } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type AuditLog = {
  id: string
  actor_type: string
  actor_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  risk_level: string
  user_agent?: string | null
  metadata_json?: Record<string, unknown> | null
  created_at?: string
}

const AuditLogsPage = () => {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")
  const [entityId, setEntityId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const query = new URLSearchParams()
    if (action) {
      query.set("action", action)
    }
    if (entityType) {
      query.set("entity_type", entityType)
    }
    if (entityId) {
      query.set("entity_id", entityId)
    }
    query.set("limit", "100")

    const data = await adminApi<{ audit_logs: AuditLog[] }>(
      `/admin/audit-logs?${query.toString()}`
    )
    setLogs(data.audit_logs)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    try {
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("audit.loadFailed"))
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("audit.title")}
        description={t("audit.description")}
      >
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="action"
            />
            <Input
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              placeholder="entity_type"
            />
            <Input
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              placeholder="entity_id"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">{t("common.actions.filter")}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAction("")
                setEntityType("")
                setEntityId("")
              }}
            >
              {t("common.actions.clear")}
            </Button>
          </div>
          <MessageBox error={error} />
        </form>
      </AdminSection>

      <AdminSection title={t("audit.logs")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.time")}</Table.HeaderCell>
              <Table.HeaderCell>{t("audit.action")}</Table.HeaderCell>
              <Table.HeaderCell>{t("audit.risk")}</Table.HeaderCell>
              <Table.HeaderCell>{t("audit.actor")}</Table.HeaderCell>
              <Table.HeaderCell>{t("audit.entity")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.metadata")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {logs.map((log) => (
              <Table.Row key={log.id}>
                <Table.Cell>{formatDate(log.created_at)}</Table.Cell>
                <Table.Cell>{log.action}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, log.risk_level)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {log.actor_type} {log.actor_id ? `/${log.actor_id}` : ""}
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {log.entity_type}:{log.entity_id || "-"}
                </Table.Cell>
                <Table.Cell className="max-w-[420px]">
                  <Text className="truncate font-mono">
                    {log.metadata_json ? JSON.stringify(log.metadata_json) : "-"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Audit Logs / 审计日志",
  rank: 23,
})

export default AuditLogsPage
