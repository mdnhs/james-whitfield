import { describe, expect, it } from "vitest"

import { runChecks, type CheckInput } from "./checks"

const good: CheckInput = {
  title: "Clinical hypnotherapy in Dublin | Magda Kennedy", // 47
  titleUnique: true,
  description:
    "Evidence-based clinical hypnotherapy for anxiety, sleep and confidence, in Dublin or online.", // 90
  ogImage: null,
  imagesMissingAlt: 0,
  hasH1: true,
  noindex: false,
  internalLinks: 2,
}
const failing = (input: Partial<CheckInput>) =>
  runChecks({ ...good, ...input })
    .filter((r) => !r.ok)
    .map((r) => r.id)

describe("runChecks (docs/brief.md §11)", () => {
  it("passes a healthy entity, generated card included", () => {
    expect(failing({})).toEqual([])
  })
  it("flags each rule on its own", () => {
    expect(failing({ title: "About | MK" })).toEqual(["title-length"])
    expect(failing({ titleUnique: false })).toEqual(["title-unique"])
    expect(failing({ description: null })).toEqual(["description"])
    expect(failing({ description: "Too short." })).toEqual(["description"])
    expect(failing({ ogImage: { width: 800, height: 800 } })).toEqual([
      "og-image",
    ])
    expect(failing({ imagesMissingAlt: 2 })).toEqual(["alt-text"])
    expect(failing({ hasH1: false })).toEqual(["h1"])
    expect(failing({ noindex: true })).toEqual(["indexable"])
    expect(failing({ internalLinks: 0 })).toEqual(["internal-link"])
  })
  it("explains failures in plain words", () => {
    const [title] = runChecks({ ...good, title: "About | MK" })
    expect(title!.message).toBe("Title is 10 characters (aim for 30–60)")
  })
})
