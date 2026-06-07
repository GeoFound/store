import fs from "fs"
import path from "path"

describe("platform decoupling boundaries", () => {
  it("keeps platform contracts and runtime free of backend framework imports", () => {
    const platformDir = path.resolve(__dirname, "..")
    const platformFiles = collectSourceFiles(platformDir).filter(
      (file) => !file.includes(`${path.sep}__tests__${path.sep}`)
    )

    for (const file of platformFiles) {
      const source = fs.readFileSync(file, "utf8")

      expect(source).not.toContain("@medusajs/")
      expect(source).not.toContain("../modules/")
      expect(source).not.toContain("../../modules/")
      expect(source).not.toContain("../platform-adapters/")
      expect(source).not.toContain("../../platform-adapters/")
    }
  })
})

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
