import { getAIProvider, listAIProviders, listAITaskPlugins } from "../../platform/ai"
import { ADMIN_CONTROL_PANEL_POLICY } from "../../platform/admin-control-panel-policy"
import { getAIRuntimeConfig } from "./config"
import { invokeAIForCapability } from "./invoke"
import type { AIInvokeSafeInput, AITaskRunSafe } from "./types"

class AiCoreModuleService {
  listProviderConfigsSafe(input?: { siteId?: string | null }) {
    const config = getAIRuntimeConfig()
    const providers = input?.siteId
      ? config.providers.filter(
          (provider) =>
            provider.site_ids.length === 0 ||
            provider.site_ids.includes(input.siteId as string)
        )
      : config.providers

    return {
      ...config,
      providers,
    }
  }

  listRegisteredProvidersSafe() {
    return listAIProviders().map((provider) => ({
      code: provider.code,
      protocol: provider.protocol || null,
      configured: provider.isConfigured?.() ?? true,
      supports_invoke: Boolean(provider.invoke),
    }))
  }

  listTaskPluginsSafe() {
    return listAITaskPlugins().map((task) => ({
      code: task.code,
      task_type: task.taskType,
      title: task.title || task.code,
      required_capabilities: task.requiredCapabilities || [],
      requires_human_review: Boolean(task.requiresHumanReview),
      runnable: Boolean(task.run),
    }))
  }

  async invokeForCapabilitySafe(input: AIInvokeSafeInput) {
    return invokeAIForCapability({
      ...input,
      resolveRegisteredProvider: (code) => getAIProvider(code) ?? null,
    })
  }

  getAdminControlPanelPolicy() {
    return ADMIN_CONTROL_PANEL_POLICY
  }

  getDashboardSnapshot(input?: {
    siteId?: string | null
    taskRuns?: AITaskRunSafe[]
  }) {
    const runtime = this.listProviderConfigsSafe(input)
    const taskRuns = input?.taskRuns ?? []
    const providersNeedingAttention = runtime.providers.filter(
      (provider) =>
        provider.enabled &&
        provider.status !== "configured" &&
        provider.status !== "disabled"
    )

    return {
      ...runtime,
      registered_providers: this.listRegisteredProvidersSafe(),
      task_plugins: this.listTaskPluginsSafe(),
      task_runs: taskRuns,
      summary: {
        provider_count: runtime.providers.length,
        configured_provider_count: runtime.providers.filter(
          (provider) => provider.status === "configured"
        ).length,
        attention_provider_count: providersNeedingAttention.length,
        review_run_count: taskRuns.filter(
          (run) => run.status === "requires_review"
        ).length,
      },
    }
  }
}

export default AiCoreModuleService
