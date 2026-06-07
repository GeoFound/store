import fs from "node:fs"
import path from "node:path"
import { validatePlatformProfileConfig } from "./config-validation"

type CliArgs = {
  profile?: string
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--profile") {
      result.profile = argv[index + 1]
      index += 1
      continue
    }

    if (arg === "-h" || arg === "--help") {
      process.stdout.write(
        "usage: ts-node src/platform-adapters/validate-profile-config.ts --profile <profiles/sites/site/env/site.json>\n"
      )
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return result
}

try {
  const args = parseArgs(process.argv.slice(2))
  const profilePath = args.profile ? path.resolve(args.profile) : ""

  if (!profilePath) {
    throw new Error("--profile is required")
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as {
    site?: {
      id?: string
    }
    platform?: Record<string, unknown>
  }
  const result = validatePlatformProfileConfig(profile.platform)

  if (!result.valid) {
    throw new Error(
      [
        `platform validation failed for ${profilePath}`,
        ...result.issues.map((issue) => `- ${issue}`),
      ].join("\n")
    )
  }

  process.stdout.write(`platform ok: ${profile.site?.id || profilePath}\n`)
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
}
