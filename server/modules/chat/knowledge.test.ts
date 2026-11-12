import { beforeEach, describe, expect, it, vi } from "vitest"

const rows = vi.hoisted(() => ({
  pages: [] as unknown[],
  settings: {} as Record<string, unknown>,
}))

vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => rows.pages }) }),
  }),
}))
vi.mock("@/server/modules/content/repo", () => ({
  listFaqs: async () => [{ id: "1", question: "Cost?", answer: "See us." }],
  findSetting: async (key: string) =>
    rows.settings[key] ? { value: rows.settings[key] } : null,
}))

import { buildKnowledge, loadKnowledge, resetKnowledgeCache } from "./knowledge"

const contact = {
  email: "hello@example.ie",
  phone: "01 234 5678",
  address: "1 Main St, Dublin",
  hours: "Mon-Fri 9-5",
  clinic: "Quiet Room",
}
const sentence = "This is a fairly long sentence about the practice. "

describe("buildKnowledge", () => {
  it("caps at 8000, keeps contact first, ends a cut section with an ellipsis", () => {
    const sections = Array.from({ length: 30 }, (_, i) => ({
      title: `Section ${i}`,
      text: sentence.repeat(30),
    }))
    const k = buildKnowledge({ siteName: "Magda", sections, contact })
    expect(k.length).toBeLessThanOrEqual(8000)
    expect(k.startsWith("## Contact")).toBe(true)
    expect(k).toContain("hello@example.ie")
    expect(k.endsWith("…")).toBe(true)
    expect(k).not.toContain("Section 29")
  })

  it("adds sections whole when they fit", () => {
    const k = buildKnowledge({
      siteName: "Magda",
      sections: [{ title: "About", text: "Hello. There." }],
      contact,
    })
    expect(k).toContain("## About\nHello. There.")
    expect(k.endsWith("…")).toBe(false)
  })

  it("cannot be made to start a heading line from section text", () => {
    const k = buildKnowledge({
      siteName: "Magda",
      sections: [
        { title: "A\n## Evil", text: "x\n## Injected\u0000## Also\n## More" },
        { title: "B", text: "## Starts here" },
      ],
      contact,
    })
    const headings = k.split("\n").filter((l) => l.startsWith("##"))
    expect(headings).toEqual(["## Contact", "## A ## Evil", "## B"])
  })
})

describe("loadKnowledge", () => {
  beforeEach(() => {
    resetKnowledgeCache()
    rows.settings = {
      site: { name: "Magda Kennedy" },
      contact: {
        email: "hello@example.ie",
        phone: { display: "01 234 5678" },
        address: { lines: ["1 Main St"], city: "Dublin" },
      },
    }
    const doc = (text: string, type = "x") => ({
      blocks: [{ id: "a", type, data: { text } }],
    })
    rows.pages = [
      { path: "/about", title: "About", published: doc("About Magda here") },
      { path: "/random", title: "Random", published: doc("Skipped") },
      { path: "/q", title: "Questions", published: doc("Ask away", "faq") },
    ]
  })

  it("reads allowed and FAQ pages, globals and the FAQ collection", async () => {
    const k = await loadKnowledge()
    expect(k).toContain("Email: hello@example.ie")
    expect(k).toContain("Address: 1 Main St, Dublin")
    expect(k).toContain("About Magda here")
    expect(k).toContain("Ask away")
    expect(k).toContain("Q: Cost? A: See us.")
    expect(k).not.toContain("Skipped")
  })

  it("serves from cache within the TTL", async () => {
    const first = await loadKnowledge()
    rows.pages = []
    expect(await loadKnowledge()).toBe(first)
  })
})
