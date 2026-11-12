import { describe, expect, it } from "vitest"

import { failingDrafts } from "./check-page-drafts-lib"

const hero = (id: string, hidden = false) => ({
  id,
  type: "hero.page",
  anchor: "home",
  chapter: "Welcome",
  hidden,
  joinPrevious: false,
  data: {
    title: "Hello",
    subtitle: "Sub",
    image: { mediaId: "8f6c1a4e-3b2d-4c5e-9f7a-1b2c3d4e5f60" },
    focal: null,
    tint: 0.3,
    mirror: false,
    cta: null,
  },
})

describe("check-page-drafts", () => {
  it("reports each draft publish would refuse, hidden blocks included", () => {
    const rows = [
      { path: "/ok", systemKey: null, draft: { blocks: [hero("block-a")] } },
      { path: "/empty", systemKey: null, draft: { blocks: [] } },
      {
        path: "/clash",
        systemKey: null,
        draft: { blocks: [hero("block-a"), hero("block-b", true)] },
      },
    ]
    const result = failingDrafts(rows)
    expect(result.map((r) => r.path)).toEqual(["/empty", "/clash"])
    expect(result[1]!.errors.join("\n")).toMatch(
      /blocks\.1\.anchor: Anchor "home" is already used on this page/
    )
  })
})
