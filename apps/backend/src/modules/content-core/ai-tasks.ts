import { registerAITaskPlugin, type AITaskRunInput } from "../../platform/ai"
import { buildContentTaskMessages, summarizeOutput } from "./ai-prompts"
import { CONTENT_CORE_PLUGIN_MANIFEST } from "./plugin"

let registered = false

const AI_CORE_SERVICE_KEY = "aiCore"

type ContentAIInvocationService = {
  invokeForCapabilitySafe(input: {
    capability: string
    providerCode?: string | null
    siteId?: string | null
    model?: string | null
    messages?: Array<{
      role: string
      content: string | Array<Record<string, unknown>>
    }>
    prompt?: string | null
    input?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }): Promise<{
    provider_code: string
    provider_protocol: string
    capability: string
    model: string | null
    output_text: string | null
    output: Record<string, unknown> | null
    usage: Record<string, unknown> | null
  }>
}

const CONTENT_AI_TASKS = [
  {
    code: "content.article_outline",
    taskType: "content.article_outline",
    title: "Content article outline",
    requiredCapabilities: ["text.generate"],
    description:
      "Creates a structured outline for a content entry using any configured text-generation provider.",
  },
  {
    code: "content.article_draft",
    taskType: "content.article_draft",
    title: "Content article draft",
    requiredCapabilities: ["text.generate"],
    description:
      "Creates a reviewable article draft from topic, source references, and site context.",
  },
  {
    code: "content.article_rewrite",
    taskType: "content.article_rewrite",
    title: "Content article rewrite",
    requiredCapabilities: ["text.generate"],
    description:
      "Rewrites an existing content revision for clarity, tone, SEO, or localization.",
  },
  {
    code: "content.seo",
    taskType: "content.seo",
    title: "Content SEO assistant",
    requiredCapabilities: ["text.generate"],
    description:
      "Produces search metadata, headings, summaries, and internal-link suggestions.",
  },
  {
    code: "content.readability",
    taskType: "content.readability",
    title: "Content readability review",
    requiredCapabilities: ["text.generate"],
    description:
      "Reviews structure, scannability, and reading friction before publication.",
  },
  {
    code: "content.tts",
    taskType: "content.tts",
    title: "Content text to speech",
    requiredCapabilities: ["speech.tts"],
    description:
      "Generates article audio using any speech-capable provider or relay.",
  },
  {
    code: "content.stt",
    taskType: "content.stt",
    title: "Content speech to text",
    requiredCapabilities: ["speech.stt"],
    description:
      "Creates article transcripts or source notes from audio-capable providers.",
  },
] as const

export function ensureContentAITasksRegistered() {
  if (registered) {
    return
  }

  registered = true

  for (const task of CONTENT_AI_TASKS) {
    const capability = task.requiredCapabilities[0]

    registerAITaskPlugin(
      {
        code: task.code,
        taskType: task.taskType,
        title: task.title,
        requiredCapabilities: [...task.requiredCapabilities],
        requiresHumanReview: true,
        run: (input) => runContentTask(task.code, capability, input),
      },
      {
        pluginId: CONTENT_CORE_PLUGIN_MANIFEST.id,
        priority: 90,
        enabled: true,
        description: task.description,
      }
    )
  }
}

async function runContentTask(
  taskCode: string,
  capability: string,
  input: AITaskRunInput
) {
  const aiCore = input.scope?.resolve(AI_CORE_SERVICE_KEY) as
    | ContentAIInvocationService
    | undefined

  if (!aiCore) {
    return {
      status: "failed" as const,
      errorMessage: "ai-core service is not available in the current scope.",
    }
  }

  const payload = isRecord(input.input) ? input.input : {}
  const messages = buildContentTaskMessages(taskCode, payload, input.sourceRefs)
  const fallbackPrompt =
    readText(payload, ["prompt", "text", "body", "content"]) || null

  if (!messages.length && !fallbackPrompt) {
    return {
      status: "failed" as const,
      errorMessage: "AI task input is empty; nothing to send to the provider.",
    }
  }

  const result = await aiCore.invokeForCapabilitySafe({
    capability,
    providerCode: input.providerCode,
    siteId: input.siteId,
    model: readText(payload, ["model"]) || null,
    messages: messages.length ? messages : undefined,
    prompt: messages.length ? undefined : fallbackPrompt,
    input: payload,
    metadata: input.metadata,
  })

  // All content AI output is gated on human review before it can be published.
  return {
    status: "requires_review" as const,
    outputSummary: summarizeOutput(result.output_text),
    output: {
      text: result.output_text,
      result: result.output,
      usage: result.usage,
      provider: {
        code: result.provider_code,
        protocol: result.provider_protocol,
        capability: result.capability,
        model: result.model,
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

export function resetContentAITasksForTests() {
  registered = false
}
