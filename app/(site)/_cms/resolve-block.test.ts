import { describe, expect, it, vi } from "vitest"

import type { BlockInstance } from "@/blocks/registry"

import { ResolvedBlock } from "./resolve-block"

describe("ResolvedBlock", () => {
  it("skips a block of unknown type with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const block = {
      id: "page-bogus",
      type: "no.such",
      anchor: "bogus",
      chapter: null,
      hidden: false,
      joinPrevious: false,
      data: {},
    } as unknown as BlockInstance
    expect(await ResolvedBlock({ block })).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no.such"))
    warn.mockRestore()
  })
})
