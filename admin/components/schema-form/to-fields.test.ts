import * as z from "zod"
import { describe, expect, it } from "vitest"

import { ui } from "./registry"
import { MediaRef, Selection, Stat, StatValue } from "@/blocks/fields"
import { BLOCKS } from "@/blocks/registry"

import { emptyValueFor, rebase, toFields } from "./to-fields"

const Schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .register(ui, { label: "Full name", placeholder: "Magda Kennedy" }),
    bio: z
      .string()
      .max(400)
      .optional()
      .register(ui, { label: "Short bio", widget: "textarea" }),
    sessions: z
      .number()
      .int()
      .min(1)
      .max(10)
      .register(ui, { label: "Sessions" }),
    newsletter: z
      .boolean()
      .default(true)
      .register(ui, { label: "Send me the newsletter" }),
    mode: z.enum(["online", "in-person"]).register(ui, {
      label: "Mode",
      widget: "radio",
      options: [
        { value: "online", label: "Online" },
        { value: "in-person", label: "In person" },
      ],
    }),
    tone: z.enum(["warm", "plain"]).register(ui, { label: "Tone" }),
    tags: z
      .array(z.string().max(30))
      .min(1)
      .max(3)
      .register(ui, { label: "Tags" }),
    address: z
      .object({ city: z.string().register(ui, { label: "City" }) })
      .register(ui, { label: "Address" }),
    confirm: z.string(),
  })
  .refine((value) => value.name === value.confirm, {
    path: ["confirm"],
    message: "x",
  })

describe("toFields", () => {
  const fields = Object.fromEntries(toFields(Schema).map((f) => [f.name, f]))

  it("reads labels and hints from the UI registry", () => {
    expect(fields.name).toMatchObject({
      widget: "text",
      label: "Full name",
      placeholder: "Magda Kennedy",
      required: true,
      maxLength: 80,
    })
  })

  it("infers widgets from the JSON Schema when none is given", () => {
    expect(fields.sessions.widget).toBe("number")
    expect(fields.newsletter).toMatchObject({
      widget: "toggle",
      required: false,
    })
    expect(fields.tone).toMatchObject({
      widget: "select",
      options: [
        { value: "warm", label: "Warm" },
        { value: "plain", label: "Plain" },
      ],
    })
    expect(fields.tags).toMatchObject({
      widget: "list",
      minItems: 1,
      maxItems: 3,
    })
    expect(fields.address.fields?.map((f) => f.name)).toEqual(["address.city"])
  })

  it("honours an explicit widget and options", () => {
    expect(fields.bio).toMatchObject({ widget: "textarea", required: false })
    expect(fields.mode.options?.[1]).toEqual({
      value: "in-person",
      label: "In person",
    })
  })

  it("humanises a field with no metadata", () => {
    expect(fields.confirm.label).toBe("Confirm")
  })
})

describe("content fields", () => {
  it("unwraps nullable fields and keeps their widget", () => {
    const [field] = toFields(z.object({ image: MediaRef.nullable() }))
    expect(field).toMatchObject({
      name: "image",
      widget: "media",
      nullable: true,
      required: false,
    })
  })
  it("names list items with a placeholder that rebase replaces", () => {
    const [list] = toFields(z.object({ stats: z.array(Stat).min(1).max(4) }))
    expect(list!.item!.widget).toBe("group")
    expect(list!.item!.fields!.map((f) => f.name)).toEqual([
      "stats.$.value",
      "stats.$.label",
    ])
    expect(list!.item!.fields![0]!.widget).toBe("stat")
    const second = rebase(list!.item!, "stats.$", "stats.1")
    expect(second.fields!.map((f) => f.name)).toEqual([
      "stats.1.value",
      "stats.1.label",
    ])
  })
  it("applies overrides by dotted path", () => {
    const [field] = toFields(z.object({ bandId: z.uuid() }), {
      bandId: { widget: "collection", collection: "cta-bands", label: "Band" },
    })
    expect(field).toMatchObject({
      widget: "collection",
      collection: "cta-bands",
      label: "Band",
    })
  })
  it("builds structurally complete starting values", () => {
    expect(emptyValueFor(z.object({ s: Selection }))).toEqual({
      s: { mode: "all" },
    })
    expect(emptyValueFor(z.object({ v: StatValue }))).toEqual({
      v: { kind: "count", value: 0, decimals: 0, prefix: "", suffix: "" },
    })
    for (const block of BLOCKS) {
      const value = emptyValueFor(block.schema) as Record<string, unknown>
      expect(Object.keys(value), block.type).toEqual(
        Object.keys(block.schema.shape)
      )
    }
  })
})
