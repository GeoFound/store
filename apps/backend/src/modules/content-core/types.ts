export type ContentEntryStatus = "draft" | "review" | "published" | "archived"

export type ContentEntryType =
  | "article"
  | "guide"
  | "report"
  | "review"
  | "resource"
  | "case_study"

export type ContentEntryListInput = {
  siteId?: string | null
  status?: ContentEntryStatus | string
  contentType?: ContentEntryType | string
  topic?: string | null
  tag?: string | null
  limit?: number
}

export type CreateContentEntryInput = {
  siteId?: string | null
  slug: string
  title: string
  excerpt?: string | null
  body?: string | null
  contentType?: ContentEntryType
  status?: ContentEntryStatus
  authorName?: string | null
  coverImageUrl?: string | null
  topic?: string | null
  tags?: string[] | string | null
  seo?: Record<string, unknown> | null
  sourceRefs?: unknown[] | Record<string, unknown> | null
  relatedProductHandles?: string[] | string | null
  aiAssisted?: boolean
  publishedAt?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export type UpdateContentEntryInput = Partial<
  Omit<CreateContentEntryInput, "slug" | "title">
> & {
  id: string
  slug?: string
  title?: string
}
