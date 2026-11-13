import { describe, expect, it } from "vitest"

import type { FormField } from "./to-fields"
import { isHalfWidth } from "./widgets"

const f = (over: Partial<FormField>): FormField =>
  ({
    name: "x",
    label: "X",
    widget: "text",
    required: false,
    node: {},
    ...over,
  }) as FormField

describe("isHalfWidth", () => {
  it("puts short controls side by side", () => {
    for (const widget of [
      "text",
      "number",
      "select",
      "media",
      "colour",
    ] as const)
      expect(isHalfWidth(f({ widget }))).toBe(true)
  })
  it("keeps long, nested and rich fields full width", () => {
    for (const widget of [
      "textarea",
      "richtext",
      "list",
      "group",
      "link",
    ] as const)
      expect(isHalfWidth(f({ widget }))).toBe(false)
    expect(isHalfWidth(f({ widget: "text", maxLength: 300 }))).toBe(false)
  })
  it("a nullable image stays half; a nullable group behind a switch goes full", () => {
    expect(isHalfWidth(f({ widget: "media", nullable: true }))).toBe(true)
    expect(isHalfWidth(f({ widget: "group", nullable: true }))).toBe(false)
  })
})
