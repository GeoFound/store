import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import {
  adminLanguageToRequestLocale,
  normalizeAdminLanguage,
} from "../../lib/admin-locale"
import resources from "../index"

interface TranslationTree {
  [key: string]: string | TranslationTree
}

function readJson(path: string): TranslationTree {
  return JSON.parse(readFileSync(path, "utf8")) as TranslationTree
}

function flattenKeys(tree: TranslationTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === "string") {
      return [nextKey]
    }

    return flattenKeys(value, nextKey)
  })
}

function findFiles(path: string, filename: string): string[] {
  if (!existsSync(path)) {
    return []
  }

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name)

    if (entry.isDirectory()) {
      return findFiles(entryPath, filename)
    }

    return entry.name === filename ? [entryPath] : []
  })
}

describe("admin translations", () => {
  const i18nDir = join(__dirname, "..")

  it("keeps English and Chinese translation keys in sync", () => {
    const englishKeys = flattenKeys(readJson(join(i18nDir, "json/en.json")))
    const chineseKeys = flattenKeys(readJson(join(i18nDir, "json/zh-CN.json")))

    expect([...new Set(englishKeys)].sort()).toEqual(
      [...new Set(chineseKeys)].sort()
    )
  })

  it("exposes Simplified Chinese through Medusa's zhCN language code", () => {
    expect(resources.zhCN.translation).toBe(resources["zh-CN"].translation)
    expect(resources.zhCN.translation).toBe(resources.zh.translation)
  })

  it("normalizes legacy and browser Chinese language codes to zh-CN", () => {
    expect(normalizeAdminLanguage("zhCN")).toBe("zh-CN")
    expect(normalizeAdminLanguage("zh")).toBe("zh-CN")
    expect(normalizeAdminLanguage("zh-Hans-CN")).toBe("zh-CN")
    expect(adminLanguageToRequestLocale("zh-CN")).toBe("zh-CN")
  })

  it("keeps admin route labels translatable instead of hard-coded bilingual text", () => {
    const routeFiles = findFiles(join(i18nDir, "..", "routes"), "page.tsx")

    for (const routeFile of routeFiles) {
      const source = readFileSync(routeFile, "utf8")

      if (!source.includes("defineRouteConfig")) {
        continue
      }

      expect(source).not.toMatch(/label:\s*["'][^"']*\/[^"']*["']/)
      expect(source).not.toMatch(/label:\s*["'][^"']*[\u4e00-\u9fff][^"']*["']/)
      expect(source).toMatch(/label:\s*["']adminRoutes\.[^"']+["']/)
      expect(source).toMatch(/translationNs:\s*["']translation["']/)
    }
  })
})
