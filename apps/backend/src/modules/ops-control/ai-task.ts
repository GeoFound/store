import { registerAITaskPlugin } from "../../platform/ai"
import { OPS_CONTROL_MODULE } from "."
import { OPS_CONTROL_PLUGIN_MANIFEST } from "./plugin"
import type OpsControlModuleService from "./service"

let registered = false

export function ensureOpsControlAITasksRegistered() {
  if (registered) {
    return
  }

  registered = true

  registerAITaskPlugin(
    {
      code: "ops.vps_maintenance_review",
      taskType: "ops-review",
      title: "VPS maintenance review",
      requiresHumanReview: true,
      async run(input) {
        try {
          const opsControl = input.scope?.resolve(
            OPS_CONTROL_MODULE
          ) as OpsControlModuleService | undefined

          if (!opsControl) {
            return {
              status: "failed",
              errorMessage: "ops-control service is not available in scope.",
            }
          }

          const snapshot = opsControl.getDashboardSnapshot()
          const criticalCount = snapshot.findings.filter(
            (finding) => finding.severity === "critical"
          ).length
          const warningCount = snapshot.findings.filter(
            (finding) => finding.severity === "warning"
          ).length

          return {
            status: criticalCount > 0 ? "requires_review" : "succeeded",
            outputSummary:
              criticalCount > 0
                ? `${criticalCount} critical and ${warningCount} warning ops findings require review.`
                : `${warningCount} warning ops findings found; no critical finding detected.`,
            output: {
              summary: snapshot.summary,
              findings: snapshot.findings,
              operator_actions: snapshot.operator_actions,
            },
          }
        } catch (error) {
          return {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Ops review failed.",
          }
        }
      },
    },
    {
      pluginId: OPS_CONTROL_PLUGIN_MANIFEST.id,
      priority: 100,
      enabled: true,
      description:
        "Reads operations-control evidence and produces a human-reviewed VPS maintenance risk summary.",
    }
  )
}

export function resetOpsControlAITasksForTests() {
  registered = false
}
