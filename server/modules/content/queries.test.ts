import { beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock("next/cache", () => next)
const repo = vi.hoisted(() => ({
  findMedia: vi.fn(),
  findArticleBySlug: vi.fn(),
  findPageByPath: vi.fn(),
  findSetting: vi.fn(),
  listServices: vi.fn(),
}))
vi.mock("./repo", () => repo)

import { MISS_LIFE } from "@/server/lib/cache"

import {
  getArticle,
  getMedia,
  getPublishedPage,
  getServices,
  getSetting,
} from "./queries"

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
  it("reads the draft only when asked", async () => {
    repo.findPageByPath.mockResolvedValue(null)
    await getPublishedPage("/about", true)
    expect(repo.findPageByPath).toHaveBeenCalledWith("/about", { draft: true })
    await getPublishedPage("/about")
    expect(repo.findPageByPath).toHaveBeenLastCalledWith("/about", {
      draft: false,
    })
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
  it("counts repeated media ids once when deciding hit or miss", async () => {
    repo.findMedia.mockResolvedValue(new Map([["m1", {}]]))
    await getMedia(["m1", "m1"])
    expect(repo.findMedia).toHaveBeenCalledWith(["m1"])
    expect(next.cacheLife).toHaveBeenCalledWith("max")
  })
  it("tags articles with services, whose slug feeds the CTA topic", async () => {
    repo.findArticleBySlug.mockResolvedValue({ id: "a1" })
    await getArticle("a")
    expect(tagsOf()).toEqual(
      expect.arrayContaining(["collection:services", "article:a1", "media"])
    )
  })
})
