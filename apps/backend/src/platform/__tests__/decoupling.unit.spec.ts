import fs from "fs"
import path from "path"

describe("platform decoupling boundaries", () => {
  it("keeps platform contracts and runtime free of backend framework imports", () => {
    expectSourceTreeToStayFrameworkNeutral(
      path.resolve(__dirname, ".."),
      "platform"
    )
  })

  it("keeps application use cases free of backend framework imports", () => {
    expectSourceTreeToStayFrameworkNeutral(
      path.resolve(__dirname, "..", "..", "application"),
      "application"
    )
  })
})

function expectSourceTreeToStayFrameworkNeutral(dir: string, label: string) {
  const files = collectSourceFiles(dir).filter(
    (file) => !file.includes(`${path.sep}__tests__${path.sep}`)
  )

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8")
    const relativePath = `${label}/${path.relative(dir, file)}`
    const forbiddenTexts = [
      "@medusajs/",
      "../modules/",
      "../../modules/",
      "../platform-adapters/",
      "../../platform-adapters/",
    ]

    for (const forbiddenText of forbiddenTexts) {
      if (source.includes(forbiddenText)) {
        throw new Error(`${relativePath} must not contain ${forbiddenText}`)
      }
    }
  }
}

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath)
    }

    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : []
  })
}
