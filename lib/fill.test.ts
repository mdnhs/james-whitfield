import { describe, expect, it } from "vitest"

import { fill } from "./fill"

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("Showing {shown} of {total}", { shown: 6, total: 6 })).toBe(
      "Showing 6 of 6"
    )
    expect(fill("{minutes} min read {x}", { minutes: 4 })).toBe(
      "4 min read {x}"
    )
  })
})
