import { describe, expect, it } from "vitest"

import type { CategoryDetail } from "@/lib/content/types"

import { categorySubject } from "./category"
import { buildMetadata } from "./metadata"

const defaults = {
  titleTemplate: "%s | Magda Kennedy",
  defaultTitle: "Magda Kennedy: Hypnotherapist",
  defaultDescription: "Clinical hypnotherapy in Dublin and online.",
  siteName: "Magda Kennedy",
  professionalTitle: "Clinical Hypnotherapist",
}
const sleep: CategoryDetail = {
  id: "c1",
  slug: "sleep",
  name: "Sleep",
  description: "Rest better.",
  seoTitle: "",
  seoDescription: "",
}

describe("category hub metadata", () => {
  it("falls back to the name, description and a self canonical", () => {
    const m = buildMetadata(categorySubject(sleep), defaults)
    expect(m.title).toEqual({ absolute: "Sleep | Magda Kennedy" })
    expect(m.description).toBe("Rest better.")
    expect(m.alternates).toEqual({ canonical: "/insights/category/sleep" })
  })

  it("prefers seoTitle and seoDescription when set", () => {
    const m = buildMetadata(
      categorySubject({
        ...sleep,
        seoTitle: "Sleep hypnotherapy",
        seoDescription: "Fall asleep faster.",
      }),
      defaults
    )
    expect(m.title).toEqual({ absolute: "Sleep hypnotherapy | Magda Kennedy" })
    expect(m.description).toBe("Fall asleep faster.")
  })
})
