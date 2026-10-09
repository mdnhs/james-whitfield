import { beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock("next/cache", () => next)
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
const repo = vi.hoisted(() => ({
  findPageByPath: vi.fn(),
  findSetting: vi.fn(),
  listServices: vi.fn(),
}))
vi.mock("./repo", () => repo)

import { MISS_LIFE } from "@/server/lib/cache"

import { getPublishedPage, getServices, getSetting } from "./queries"

const tagsOf = () => next.cacheTag.mock.calls.flat()

beforeEach(() => {
  vi.clearAllMocks()
})

// Review Focus 2: requests before `pnpm db:seed` must not pin "nothing"
// for a year.
describe("cached content queries", () => {
  it("caches a missing page briefly, under the routes tag", async () => {
    repo.findPageByPath.mockResolvedValue(null)
    expect(await getPublishedPage("/nope")).toBeNull()
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("routes")
  })
  it("caches a found page for good, under its own tag and routes", async () => {
    repo.findPageByPath.mockResolvedValue({ id: "p1", path: "/about" })
    await getPublishedPage("/about")
    expect(next.cacheLife).toHaveBeenCalledWith("max")
    expect(tagsOf()).toEqual(expect.arrayContaining(["routes", "page:p1"]))
  })
  it("treats an empty collection as a miss", async () => {
    repo.listServices.mockResolvedValue([])
    await getServices()
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("collection:services")
  })
  it("parses a missing setting to its defaults, briefly", async () => {
    repo.findSetting.mockResolvedValue(null)
    expect(await getSetting("navigation")).toEqual({
      links: [],
      cta: { label: "", href: "" },
    })
    expect(next.cacheLife).toHaveBeenCalledWith(MISS_LIFE)
    expect(tagsOf()).toContain("settings:navigation")
  })
})
