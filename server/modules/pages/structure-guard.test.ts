import { describe, expect, it } from "vitest"

import { ApiError } from "@/server/api/errors"

import { assertSameStructure } from "./structure-guard"

const b = (anchor: string) => ({ type: "richtext", anchor, hidden: false })

describe("assertSameStructure", () => {
  it("passes for the same structure", () => {
    expect(() =>
      assertSameStructure({ blocks: [b("a")] }, { blocks: [b("a")] })
    ).not.toThrow()
  })

  it("throws VALIDATION_FAILED with the default or given message", () => {
    const run = (message?: string) => () =>
      assertSameStructure({ blocks: [b("a")] }, { blocks: [b("z")] }, message)
    expect(run()).toThrow(ApiError)
    expect(run()).toThrow("Sections are fixed on this page")
    expect(run("custom")).toThrow("custom")
    try {
      run()()
    } catch (e) {
      expect((e as ApiError).code).toBe("VALIDATION_FAILED")
    }
  })
})
