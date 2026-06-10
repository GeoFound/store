import type { OpsControlDashboardSnapshot } from "./types"

export const OPERATOR_ACTIONS: OpsControlDashboardSnapshot["operator_actions"] = [
  {
    id: "deploy.rollback",
    title: "Rollback deployment",
    risk: "high",
    requires_human_confirmation: true,
    available_now: true,
    evidence_required: [
      "failing release id",
      "target release id",
      "pnpm deploy:health after rollback",
    ],
  },
  {
    id: "system.restart-services",
    title: "Restart production services",
    risk: "medium",
    requires_human_confirmation: true,
    available_now: false,
    evidence_required: [
      "systemd unit status before restart",
      "journal error excerpt",
      "pnpm deploy:health after restart",
    ],
  },
  {
    id: "backup.restore-test",
    title: "Run backup restore proof",
    risk: "medium",
    requires_human_confirmation: true,
    available_now: false,
    evidence_required: [
      "latest backup artifact",
      "separate restore target",
      "restore command output",
    ],
  },
]
