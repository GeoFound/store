import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Heading, Input, Table, Text } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdminSection } from "../../components/admin-section"
import { MessageBox } from "../../components/message-box"
import {
  ensureAdminExtensionsRegistered,
} from "../../extensions/defaults"
import { renderAdminExtensions } from "../../extensions/registry"
import { adminApi, formatDate } from "../../lib/admin-api"
import { translatedStatus } from "../../lib/i18n"

type PaymentChannel = {
  id: string
  code: string
  display_name: string
  type: string
  enabled: boolean
  priority: number
  provider_code: string
  health_status: string
}

type PaymentAttempt = {
  id: string
  cart_id?: string | null
  provider_code: string
  provider_order_id?: string | null
  amount: number
  currency: string
  status: string
  paid_at?: string | null
  created_at?: string
}

const PaymentsPage = () => {
  ensureAdminExtensionsRegistered()
  const { t } = useTranslation()

  const [channels, setChannels] = useState<PaymentChannel[]>([])
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([])
  const [selectedAttemptId, setSelectedAttemptId] = useState("")
  const [markPaidNote, setMarkPaidNote] = useState("")
  const [newChannelCode, setNewChannelCode] = useState("")
  const [newChannelName, setNewChannelName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [channelData, attemptData] = await Promise.all([
      adminApi<{ channels: PaymentChannel[] }>("/admin/payment-channels"),
      adminApi<{ attempts: PaymentAttempt[] }>("/admin/payment-attempts"),
    ])
    setChannels(channelData.channels)
    setAttempts(attemptData.attempts)
  }

  async function markPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi(`/admin/payment-attempts/${selectedAttemptId}/mark-paid`, {
        method: "POST",
        body: {
          note: markPaidNote,
        },
      })
      setMessage(t("payments.markPaidSuccess"))
      setSelectedAttemptId("")
      setMarkPaidNote("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.markPaidFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await adminApi("/admin/payment-channels", {
        method: "POST",
        body: {
          code: newChannelCode,
          name: newChannelName,
          display_name: newChannelName,
          type: "manual",
          provider_code: newChannelCode,
        },
      })
      setMessage(t("payments.channelCreated"))
      setNewChannelCode("")
      setNewChannelName("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.createFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function toggleChannel(channel: PaymentChannel) {
    setError("")
    setMessage("")

    try {
      await adminApi(`/admin/payment-channels/${channel.id}`, {
        method: "POST",
        body: {
          enabled: !channel.enabled,
        },
      })
      setMessage(t("payments.channelUpdated"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("payments.updateFailed"))
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <AdminSection
        title={t("payments.channels")}
        description={t("payments.channelsDescription")}
      >
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("payments.channel")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.type")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.provider")}</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {channels.map((channel) => (
              <Table.Row key={channel.id}>
                <Table.Cell>
                  <div>
                    <Heading level="h3">{channel.display_name}</Heading>
                    <Text className="font-mono text-ui-fg-subtle">{channel.code}</Text>
                  </div>
                </Table.Cell>
                <Table.Cell>{channel.type}</Table.Cell>
                <Table.Cell>
                  <Badge>
                    {translatedStatus(
                      t,
                      channel.enabled ? channel.health_status : "disabled"
                    )}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{channel.provider_code}</Table.Cell>
                <Table.Cell>
                  <Button variant="secondary" onClick={() => toggleChannel(channel)}>
                    {channel.enabled ? t("payments.disable") : t("payments.enable")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("payments.createManualChannel")}>
        <form onSubmit={createChannel} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={newChannelCode}
              onChange={(event) => setNewChannelCode(event.target.value)}
              placeholder="provider_code"
            />
            <Input
              value={newChannelName}
              onChange={(event) => setNewChannelName(event.target.value)}
              placeholder={t("payments.displayName")}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {t("payments.createChannel")}
          </Button>
        </form>
      </AdminSection>

      <AdminSection title={t("payments.attempts")}>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{t("common.fields.attempt")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.status")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.amount")}</Table.HeaderCell>
              <Table.HeaderCell>{t("payments.providerOrder")}</Table.HeaderCell>
              <Table.HeaderCell>{t("common.fields.created")}</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {attempts.map((attempt) => (
              <Table.Row key={attempt.id}>
                <Table.Cell className="font-mono">{attempt.id}</Table.Cell>
                <Table.Cell>
                  <Badge>{translatedStatus(t, attempt.status)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  {attempt.amount} {attempt.currency}
                </Table.Cell>
                <Table.Cell className="font-mono">
                  {attempt.provider_order_id || "-"}
                </Table.Cell>
                <Table.Cell>{formatDate(attempt.created_at)}</Table.Cell>
                <Table.Cell>
                  <Button
                    variant="secondary"
                    disabled={attempt.status === "paid"}
                    onClick={() => setSelectedAttemptId(attempt.id)}
                  >
                    {t("payments.markPaid")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </AdminSection>

      <AdminSection title={t("payments.manualConfirmation")}>
        <form onSubmit={markPaid} className="grid gap-4">
          <Input
            value={selectedAttemptId}
            onChange={(event) => setSelectedAttemptId(event.target.value)}
            placeholder="payment_attempt_id"
          />
          <Input
            value={markPaidNote}
            onChange={(event) => setMarkPaidNote(event.target.value)}
            placeholder={t("payments.note")}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading || !selectedAttemptId}>
              {t("payments.markPaid")}
            </Button>
            <Button type="button" variant="secondary" onClick={refresh}>
              {t("common.actions.refresh")}
            </Button>
          </div>
          <MessageBox error={error} success={message} />
        </form>
      </AdminSection>

      {renderAdminExtensions("payments.after", {}).map((entry) => (
        <div key={entry.key}>{entry.node}</div>
      ))}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Payments / 支付",
  rank: 24,
})

export default PaymentsPage
