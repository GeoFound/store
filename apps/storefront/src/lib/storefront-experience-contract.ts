import fs from "node:fs"
import path from "node:path"

type StorefrontExperiencePolicyInput = {
  pageContracts?: unknown
  sectionTypes?: unknown
  pageSectionTypes?: unknown
}

export const STOREFRONT_EXPERIENCE_POLICY_PATH = resolveExperiencePolicyPath()
const storefrontExperiencePolicy = readPolicy(STOREFRONT_EXPERIENCE_POLICY_PATH)

export const STOREFRONT_EXPERIENCE_PAGE_KEYS = readStringArray(
  storefrontExperiencePolicy.pageContracts,
  "pageContracts"
)

export const EXPERIENCE_SECTION_TYPE_KEYS = readSectionTypeArray(
  storefrontExperiencePolicy.sectionTypes
)

const EXPERIENCE_PAGE_KEY_SET = new Set(STOREFRONT_EXPERIENCE_PAGE_KEYS)
export const EXPERIENCE_SECTION_TYPES = new Set(EXPERIENCE_SECTION_TYPE_KEYS)

export const EXPERIENCE_PAGE_SECTION_TYPES = readPageSectionTypes(
  storefrontExperiencePolicy.pageSectionTypes
)

export function normalizeExperienceContractSectionType(value: unknown) {
  return toNonEmptyString(value).toLowerCase().replace(/_/g, "-")
}

export function isExperiencePageKey(value: string) {
  return EXPERIENCE_PAGE_KEY_SET.has(value)
}

export function isExperienceSectionType(value: string) {
  return EXPERIENCE_SECTION_TYPES.has(value)
}

export function isExperienceSectionAllowedForPage(
  pageKey: string,
  sectionType: string
) {
  return (
    EXPERIENCE_PAGE_SECTION_TYPES[pageKey]?.includes(sectionType) ?? false
  )
}

export function allowedExperienceSectionsForPage(pageKey: string) {
  return EXPERIENCE_PAGE_SECTION_TYPES[pageKey] || []
}

function resolveExperiencePolicyPath() {
  const candidates = [
    path.resolve(process.cwd(), ".ai", "storefront-experience-policy.json"),
    path.resolve(
      process.cwd(),
      "..",
      "..",
      ".ai",
      "storefront-experience-policy.json"
    ),
  ]
  const existingPath = candidates.find((candidate) => fs.existsSync(candidate))

  return existingPath || candidates[1]
}

function readPolicy(filePath: string): StorefrontExperiencePolicyInput {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as StorefrontExperiencePolicyInput
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error"

    throw new Error(`Failed to load storefront experience policy: ${message}`)
  }
}

function readStringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`storefront experience policy ${field} must be an array`)
  }

  const entries = value.map((item, index) => {
    const normalized = toNonEmptyString(item)

    if (!normalized) {
      throw new Error(
        `storefront experience policy ${field}[${index}] must be a non-empty string`
      )
    }

    return normalized
  })

  return Array.from(new Set(entries))
}

function readSectionTypeArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("storefront experience policy sectionTypes must be an array")
  }

  const entries = value.map((item, index) => {
    const source = item as { type?: unknown }
    const normalized = normalizeExperienceContractSectionType(source?.type)

    if (!normalized) {
      throw new Error(
        `storefront experience policy sectionTypes[${index}].type must be a non-empty string`
      )
    }

    return normalized
  })

  return Array.from(new Set(entries))
}

function readPageSectionTypes(value: unknown): Record<string, readonly string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "storefront experience policy pageSectionTypes must be an object"
    )
  }

  const result: Record<string, readonly string[]> = {}
  const source = value as Record<string, unknown>

  for (const pageKey of STOREFRONT_EXPERIENCE_PAGE_KEYS) {
    const sectionTypes = readStringArray(
      source[pageKey],
      `pageSectionTypes.${pageKey}`
    ).map((sectionType) =>
      normalizeExperienceContractSectionType(sectionType)
    )

    if (!sectionTypes.length) {
      throw new Error(
        `storefront experience policy pageSectionTypes.${pageKey} must include at least one section type`
      )
    }

    for (const sectionType of sectionTypes) {
      if (!EXPERIENCE_SECTION_TYPES.has(sectionType)) {
        throw new Error(
          `storefront experience policy pageSectionTypes.${pageKey} contains unknown section type: ${sectionType}`
        )
      }
    }

    result[pageKey] = Array.from(new Set(sectionTypes))
  }

  for (const pageKey of Object.keys(source)) {
    if (!EXPERIENCE_PAGE_KEY_SET.has(pageKey)) {
      throw new Error(
        `storefront experience policy pageSectionTypes contains unknown page: ${pageKey}`
      )
    }
  }

  return Object.freeze(result)
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}
