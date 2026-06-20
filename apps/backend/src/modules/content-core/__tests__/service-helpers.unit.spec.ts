import {
  buildPatch,
  getReadingStats,
  toRecordList,
  type PatchField,
} from "../service-helpers"

type SampleInput = {
  title?: string | null
  count?: number | null
  tags?: string[] | null
}

const FIELDS: Array<PatchField<SampleInput>> = [
  { key: "title", column: "title", map: (value) => String(value).trim() },
  { key: "count", column: "count" },
  { key: "tags", column: "tags_json" },
]

describe("buildPatch", () => {
  it("only includes keys that are explicitly provided", () => {
    expect(buildPatch({ title: " Hi " } as SampleInput, FIELDS)).toEqual({
      title: "Hi",
    })
  })

  it("includes provided null values but skips undefined ones", () => {
    expect(buildPatch({ title: null, count: 3 } as SampleInput, FIELDS)).toEqual({
      title: "null",
      count: 3,
    })
  })

  it("passes unmapped values through unchanged", () => {
    expect(buildPatch({ tags: ["a", "b"] } as SampleInput, FIELDS)).toEqual({
      tags_json: ["a", "b"],
    })
  })
})

describe("toRecordList", () => {
  it("keeps only plain object entries", () => {
    expect(toRecordList([{ a: 1 }, "x", 2, null, ["y"]])).toEqual([{ a: 1 }])
  })

  it("wraps a single record and ignores non-records", () => {
    expect(toRecordList({ a: 1 })).toEqual([{ a: 1 }])
    expect(toRecordList(null)).toEqual([])
    expect(toRecordList("text")).toEqual([])
  })
})

describe("getReadingStats", () => {
  it("counts latin words and CJK characters together", () => {
    expect(getReadingStats("hello world")).toMatchObject({ wordCount: 2 })
    expect(getReadingStats("你好 world")).toMatchObject({ wordCount: 3 })
  })

  it("returns nulls for empty content", () => {
    expect(getReadingStats("")).toEqual({
      readingTimeMinutes: null,
      wordCount: null,
    })
  })
})
