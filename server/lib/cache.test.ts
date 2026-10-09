import { beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => next)

import { invalidate, tags } from "./cache"

beforeEach(() => next.revalidateTag.mockReset())

describe("invalidate", () => {
  it("expires each tag once, immediately", () => {
    invalidate([tags.page("p1"), tags.routes, tags.routes])
    expect(next.revalidateTag.mock.calls).toEqual([
      ["page:p1", { expire: 0 }],
      ["routes", { expire: 0 }],
    ])
  })
  it("names tags as the catalogue does (docs/brief.md §5.6)", () => {
    expect([
      tags.setting("footer"),
      tags.collection("steps"),
      tags.article("a1"),
    ]).toEqual(["settings:footer", "collection:steps", "article:a1"])
  })
})
