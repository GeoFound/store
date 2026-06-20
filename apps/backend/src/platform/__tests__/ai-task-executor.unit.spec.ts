import {
  registerAITaskPlugin,
  runAITaskPlugin,
  type AITaskRunResult,
} from "../ai"
import {
  configurePlatformRuntime,
  resetPlatformRuntimeForTests,
} from "../runtime"

describe("runAITaskPlugin executor", () => {
  beforeEach(() => {
    configurePlatformRuntime({ includeDefaults: false })
  })

  afterEach(() => {
    resetPlatformRuntimeForTests()
  })

  it("returns a failed result when the plugin is not registered", async () => {
    const outcome = await runAITaskPlugin("content.missing", {})

    expect(outcome.plugin).toBeNull()
    expect(outcome.result.status).toBe("failed")
    expect(outcome.result.errorMessage).toContain("not registered")
  })

  it("executes a registered plugin run step", async () => {
    const run = jest.fn(
      async (): Promise<AITaskRunResult> => ({
        status: "requires_review",
        outputSummary: "ok",
        output: { text: "done" },
      })
    )

    registerAITaskPlugin(
      { code: "content.demo", taskType: "content.demo", run },
      { pluginId: "content-core", enabled: true }
    )

    const outcome = await runAITaskPlugin("content.demo", {
      siteId: "global",
      input: { topic: "x" },
    })

    expect(run).toHaveBeenCalledTimes(1)
    expect(outcome.plugin).toMatchObject({ code: "content.demo" })
    expect(outcome.result.status).toBe("requires_review")
    expect(outcome.result.output).toEqual({ text: "done" })
  })

  it("converts a thrown plugin error into a failed result", async () => {
    registerAITaskPlugin(
      {
        code: "content.boom",
        taskType: "content.boom",
        run() {
          throw new Error("provider exploded")
        },
      },
      { pluginId: "content-core", enabled: true }
    )

    const outcome = await runAITaskPlugin("content.boom", {})

    expect(outcome.result.status).toBe("failed")
    expect(outcome.result.errorMessage).toBe("provider exploded")
  })

  it("fails cleanly when a plugin has no run implementation", async () => {
    registerAITaskPlugin(
      { code: "content.norun", taskType: "content.norun" },
      { pluginId: "content-core", enabled: true }
    )

    const outcome = await runAITaskPlugin("content.norun", {})

    expect(outcome.result.status).toBe("failed")
    expect(outcome.result.errorMessage).toContain("executable run step")
  })
})
