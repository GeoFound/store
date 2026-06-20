import type { BackendRuntimeContext } from "./backend-context"
import type {
  PlatformResolutionContext,
  VersionedPluginContract,
} from "./contracts"
import { getPlatformRuntime } from "./runtime"

export type AIMessage = {
  role: "system" | "user" | "assistant" | "tool" | string
  content: string | Array<Record<string, unknown>>
}

export type AIProviderConfigSnapshot = {
  code: string
  label?: string
  providerKind?: string
  protocol?: string
  baseUrl?: string | null
  defaultModel?: string | null
  capabilities?: string[]
  apiKeyEnv?: string | null
  siteIds?: string[]
  metadata?: Record<string, unknown> | null
}

export type AIInvokeInput = {
  scope?: BackendRuntimeContext
  providerConfig?: AIProviderConfigSnapshot
  model?: string | null
  messages?: AIMessage[]
  prompt?: string
  input?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export type AIInvokeResult = {
  outputText?: string | null
  output?: Record<string, unknown> | null
  raw?: Record<string, unknown> | null
  usage?: Record<string, unknown> | null
}

export interface AIProvider {
  code: string
  protocol?: string
  isConfigured?(config?: AIProviderConfigSnapshot): boolean
  invoke?(input: AIInvokeInput): Promise<AIInvokeResult> | AIInvokeResult
}

export type AITaskRunInput = {
  scope?: BackendRuntimeContext
  providerCode?: string | null
  siteId?: string | null
  sourceRefs?: Array<Record<string, unknown>>
  input?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type AITaskRunResult = {
  status: "succeeded" | "failed" | "requires_review"
  output?: Record<string, unknown> | null
  outputSummary?: string | null
  artifactRefs?: Array<Record<string, unknown>>
  errorMessage?: string | null
}

export interface AITaskPlugin {
  code: string
  taskType: string
  title?: string
  requiredCapabilities?: string[]
  requiresHumanReview?: boolean
  run?(input: AITaskRunInput): Promise<AITaskRunResult> | AITaskRunResult
}

export function registerAIProvider(
  provider: AIProvider,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<AIProvider>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<AIProvider>(
    {
      capability: "ai-provider",
      name: provider.code,
      pluginId: input.pluginId,
      version: input.version || "v1",
      implementation: provider,
      priority: input.priority,
      enabled: input.enabled,
      scope: input.scope,
      description: input.description,
    },
    input.pluginId
  )
}

export function getAIProvider(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<AIProvider>(
    "ai-provider",
    code,
    context
  )
}

export function listAIProviders(context?: PlatformResolutionContext) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("ai-provider")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const providers: AIProvider[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const provider = runtime.resolveContract<AIProvider>(
      "ai-provider",
      name,
      context
    )

    if (provider) {
      providers.push(provider)
    }
  }

  return providers
}

export function registerAITaskPlugin(
  task: AITaskPlugin,
  input: {
    pluginId: string
    version?: string
    priority?: number
    enabled?: boolean
    scope?: VersionedPluginContract<AITaskPlugin>["scope"]
    description?: string
  }
) {
  getPlatformRuntime().registerContract<AITaskPlugin>(
    {
      capability: "ai-task-plugin",
      name: task.code,
      pluginId: input.pluginId,
      version: input.version || "v1",
      implementation: task,
      priority: input.priority,
      enabled: input.enabled,
      scope: input.scope,
      description: input.description,
    },
    input.pluginId
  )
}

export function getAITaskPlugin(
  code: string,
  context?: PlatformResolutionContext
) {
  return getPlatformRuntime().resolveContract<AITaskPlugin>(
    "ai-task-plugin",
    code,
    context
  )
}

export type AITaskPluginMetadata = {
  code: string
  taskType: string
  requiresHumanReview: boolean
}

export type RunAITaskPluginOutcome = {
  plugin: AITaskPluginMetadata | null
  result: AITaskRunResult
}

/**
 * Resolves a registered AI task plugin by code and executes its `run`
 * implementation, normalizing missing plugins and thrown errors into a
 * `failed` result. This is the single executor that turns a registered
 * `AITaskPlugin` contract into an actual run.
 */
export async function runAITaskPlugin(
  code: string,
  input: AITaskRunInput,
  context?: PlatformResolutionContext
): Promise<RunAITaskPluginOutcome> {
  const plugin = getAITaskPlugin(code, context)

  if (!plugin) {
    return {
      plugin: null,
      result: {
        status: "failed",
        errorMessage: `AI task plugin "${code}" is not registered or is disabled.`,
      },
    }
  }

  const metadata: AITaskPluginMetadata = {
    code: plugin.code,
    taskType: plugin.taskType,
    requiresHumanReview: Boolean(plugin.requiresHumanReview),
  }

  if (!plugin.run) {
    return {
      plugin: metadata,
      result: {
        status: "failed",
        errorMessage: `AI task plugin "${code}" does not implement an executable run step.`,
      },
    }
  }

  try {
    const result = await plugin.run(input)
    return { plugin: metadata, result }
  } catch (error) {
    return {
      plugin: metadata,
      result: {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "AI task plugin execution failed.",
      },
    }
  }
}

export function listAITaskPlugins(context?: PlatformResolutionContext) {
  const runtime = getPlatformRuntime()
  const sortedNames = runtime
    .listContracts("ai-task-plugin")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((contract) => contract.name)
  const seen = new Set<string>()
  const tasks: AITaskPlugin[] = []

  for (const name of sortedNames) {
    if (seen.has(name)) {
      continue
    }

    seen.add(name)
    const task = runtime.resolveContract<AITaskPlugin>(
      "ai-task-plugin",
      name,
      context
    )

    if (task) {
      tasks.push(task)
    }
  }

  return tasks
}
