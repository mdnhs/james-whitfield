import { describe, expect, it } from "vitest"

import type { FormField } from "@/admin/components/schema-form/to-fields"
import { toFields } from "@/admin/components/schema-form/to-fields"
import { BLOCK_BY_TYPE, BLOCKS, type BlockType } from "@/blocks/registry"

import { BLOCK_FIELD_UI } from "./block-ui"

const all = (fields: FormField[]): FormField[] =>
  fields.flatMap((f) => [
    f,
    ...all(f.fields ?? []),
    ...(f.item ? all([f.item]) : []),
  ])
const fieldsOf = (type: BlockType) =>
  all(toFields(BLOCK_BY_TYPE[type].schema, BLOCK_FIELD_UI[type]))
const at = (type: BlockType, name: string) => {
  const field = fieldsOf(type).find((f) => f.name === name)
  if (!field) throw new Error(`${type}: no field ${name}`)
  return field
}

describe("block widgets (the checklist in the plan)", () => {
  it.each([
    ["hero.home", "primaryCta", "link"],
    ["hero.home", "members.count", "stat"],
    ["hero.home", "members.avatars.$", "media"],
    ["hero.page", "image", "media"],
    ["hero.page", "focal", "focal"],
    ["credibility", "badges.$.icon", "icon"],
    ["about.intro", "paragraphs.$", "textarea"],
    ["about.intro", "stats.$.value", "stat"],
    ["about.story", "badge.value", "stat"],
    ["about.approach", "principles.$.icon", "icon"],
    ["testimonials", "selection", "collection"],
    ["band", "bandId", "collection"],
    ["insights.latest", "selection", "collection"],
    ["faq", "selection", "collection"],
    ["richtext", "doc", "richtext"],
    ["contact.clinic", "photo", "media"],
  ] as const)("%s %s → %s", (type, name, widget) => {
    expect(at(type, name).widget).toBe(widget)
  })
  it("names the source of every collection picker", () => {
    expect(at("testimonials", "selection").collection).toBe("testimonials")
    expect(at("band", "bandId").collection).toBe("cta-bands")
    expect(at("insights.latest", "selection").collection).toBe("articles")
    expect(at("faq", "selection").collection).toBe("faqs")
    for (const block of BLOCKS) {
      for (const field of fieldsOf(block.type)) {
        if (field.widget === "collection")
          expect(field.collection, `${block.type} ${field.name}`).toBeDefined()
      }
    }
  })
  it("marks the optional parts nullable", () => {
    expect(at("hero.page", "focal").nullable).toBe(true)
    expect(at("band", "tint").nullable).toBe(true)
    expect(at("newsletter", "override").nullable).toBe(true)
    expect(at("about.credentials", "items.$.url").nullable).toBe(true)
  })
})
