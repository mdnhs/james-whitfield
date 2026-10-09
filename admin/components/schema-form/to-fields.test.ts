import * as z from "zod"
import { describe, expect, it } from "vitest"

import { ui } from "./registry"
import { toFields } from "./to-fields"

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
