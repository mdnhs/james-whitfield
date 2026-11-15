import { describe, expect, it } from "vitest"

import { sectionBlocks } from "@/admin/components/schema-form/schema-form"
import { toFields } from "@/admin/components/schema-form/to-fields"
import { GLOBALS } from "@/lib/content/globals"

import { GLOBAL_FIELD_UI } from "./global-ui"

describe("SEO defaults form", () => {
  const blocks = sectionBlocks(toFields(GLOBALS.seo, GLOBAL_FIELD_UI.seo))

  it("draws each section and group as its own titled card", () => {
    expect(blocks.map((b) => b.title)).toEqual([
      "Titles & descriptions",
      "Social sharing",
      "Indexing",
      "Search engine verification",
      "Business details (structured data)",
      "AI assistants (llms.txt)",
    ])
    expect(blocks.every((b) => b.icon)).toBe(true)
    expect(blocks[1]!.fields.map((f) => f.name)).toEqual([
      "defaultOgImage",
      "twitterHandle",
    ])
    expect(blocks[2]!.fields.map((f) => f.name)).toEqual([
      "robots",
      "preferredHost",
    ])
    expect(blocks[4]!.fields.map((f) => f.name)).toContain(
      "business.reviewCount"
    )
  })
})

describe("sectionBlocks", () => {
  it("keeps a form without sections as one plain block", () => {
    const fields = toFields(GLOBALS.notifications)
    expect(sectionBlocks(fields)).toEqual([{ fields }])
  })
})
