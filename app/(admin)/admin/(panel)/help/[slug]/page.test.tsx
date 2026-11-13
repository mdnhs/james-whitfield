import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RoleName } from "@/lib/auth/permissions"

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND")
})
const actor = { id: "u1", roles: ["owner"] as RoleName[] }
const requireActor = vi.fn(async () => actor)
const requirePermission = vi.fn(async () => actor)

vi.mock("next/navigation", () => ({ notFound }))
vi.mock("@/server/auth/session", () => ({ requireActor, requirePermission }))

const { default: HelpArticlePage, generateStaticParams } =
  await import("./page")

// The page suspends on one async child: run it as React would.
const open = (slug: string) => {
  const page = HelpArticlePage({
    params: Promise.resolve({ slug }),
  } as never) as ReactElement<{ children: ReactElement<{ params: unknown }> }>
  const gate = page.props.children
  return (gate.type as (props: unknown) => Promise<ReactElement>)(gate.props)
}

describe("/admin/help/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actor.roles = ["owner"]
  })

  it("prerenders every article", () => {
    expect(generateStaticParams()).toContainEqual({ slug: "media" })
  })

  it("signs the visitor in, then serves the article", async () => {
    const element = await open("media")
    expect(requireActor).toHaveBeenCalledWith("/admin/help/media")
    expect(requirePermission).toHaveBeenCalledWith(
      { dashboard: ["view"] },
      "/admin/help/media"
    )
    expect((element.props as { article: { slug: string } }).article.slug).toBe(
      "media"
    )
  })

  it("is a 404 for an unknown article", async () => {
    await expect(open("nope")).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("is a 404 for an article about screens the role cannot open", async () => {
    actor.roles = ["intake"]
    await expect(open("website-pages")).rejects.toThrow("NEXT_NOT_FOUND")
    actor.roles = ["intake"]
    await expect(open("enquiries")).resolves.toBeDefined()
  })
})
