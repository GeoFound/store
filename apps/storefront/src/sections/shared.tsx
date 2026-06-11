import { Fragment, type ReactNode } from "react"
import type { SiteExperienceSectionConfig } from "@/lib/site-config"

export function sectionAttributes(section: SiteExperienceSectionConfig) {
  return {
    "data-section-type": section.type,
    "data-section-variant": section.variant,
    "data-section-goal": section.goal || undefined,
  }
}

export function renderConfiguredSections(
  sections: SiteExperienceSectionConfig[],
  renderSection: (
    section: SiteExperienceSectionConfig,
    index: number
  ) => ReactNode
) {
  return sections.map((section, index) => {
    if (!section.enabled) {
      return null
    }

    const rendered = renderSection(section, index)

    if (!rendered) {
      return null
    }

    return (
      <Fragment key={`${section.type}:${section.variant}:${index}`}>
        {rendered}
      </Fragment>
    )
  })
}
