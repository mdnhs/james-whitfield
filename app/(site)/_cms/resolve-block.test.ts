import { describe, expect, it, vi } from "vitest"

import type { BlockInstance } from "@/blocks/registry"

import { getRouteTable } from "@/server/modules/redirects/queries"

import { ResolvedBlock } from "./resolve-block"

vi.mock("@/server/modules/redirects/queries", () => ({
  getRouteTable: vi.fn(),
}))
vi.mock("@/server/modules/content/queries", () => ({
  getServices: vi.fn(async () => [
    { id: "1", title: "A", pagePath: "/services/a" },
    { id: "2", title: "B", pagePath: "/services/b" },
  ]),
}))

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

  it("links a service's Learn more only to a live page", async () => {
    vi.mocked(getRouteTable).mockResolvedValue({
      live: ["/services/a"],
    } as never)
    const block = {
      id: "g",
      type: "services.grid",
      anchor: "grid",
      chapter: null,
      hidden: false,
      joinPrevious: false,
      data: {
        eyebrow: "",
        title: "",
        intro: "",
        more: { label: "", href: "" },
      },
    } as unknown as BlockInstance
    const el = (await ResolvedBlock({ block })) as {
      props: { services: { pagePath: string }[] }
    }
    expect(el.props.services.map((s) => s.pagePath)).toEqual([
      "/services/a",
      "",
    ])
  })
})
