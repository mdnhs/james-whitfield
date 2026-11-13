import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`)
})
const requireActor = vi.fn(async () => ({ id: "u1", roles: ["owner"] }))

vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/server/auth/session", () => ({ requireActor }))

const { default: WebsiteIndex } = await import("./page")

describe("/admin/website", () => {
  it("signs the visitor in, then redirects to the Home screen", async () => {
    // The page suspends on one async child: run it as React would.
    const page = WebsiteIndex() as ReactElement<{ children: ReactElement }>
    const go = page.props.children.type as () => Promise<never>
    await expect(go()).rejects.toThrow("NEXT_REDIRECT /admin/website/home")
    expect(requireActor).toHaveBeenCalledWith("/admin/website")
    expect(redirect).toHaveBeenCalledWith("/admin/website/home")
  })
})
