import { describe, expect, it, vi } from "vitest"

import type { PublishedPage } from "@/lib/content/types"
import { getPublishedPage } from "@/server/modules/content/queries"

import { PageJsonLd } from "./page-json-ld"

vi.mock("next/cache", () => ({ io: async () => {} }))
vi.mock("@/server/env", () => ({
  getEnv: () => ({ SITE_URL: "https://example.ie/" }),
}))
vi.mock("@/server/modules/content/queries", () => ({
  getFaqs: vi.fn(async () => []),
  getMedia: vi.fn(async () => new Map()),
  getPlans: vi.fn(async () => []),
  getPublishedPage: vi.fn(async () => null),
  getServices: vi.fn(async () => []),
  getSetting: vi.fn(async (key: string) =>
    key === "microcopy" ? { breadcrumbHome: "Home" } : { name: "Magda" }
  ),
}))

const block = (type: string, data: unknown) => ({
  id: type,
  type,
  anchor: type,
  chapter: null,
  hidden: false,
  joinPrevious: false,
  data,
})

const servicePage = {
  id: "p",
  path: "/services/anxiety",
  title: "Anxiety",
  systemKey: null,
  document: {
    blocks: [
      block("service.faq", {
        title: "FAQ",
        subtitle: "",
        initiallyOpen: null,
        items: [{ question: "Does it work?", answer: "Often." }],
      }),
      block("service.formats", {
        eyebrow: "",
        title: "Formats",
        subtitle: "",
        featuredTag: "",
        plans: [
          {
            name: "Single",
            priceLabel: "€90",
            unit: "session",
            summary: "One session.",
            features: [],
            ctaLabel: "Book",
            featured: false,
          },
        ],
      }),
    ],
  },
} as unknown as PublishedPage

describe("PageJsonLd on a service page", () => {
  it("emits FAQPage and offers from the inline blocks", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(null)
    const el = await PageJsonLd({ page: servicePage })
    const nodes = (el.props.graph as { "@graph": Record<string, unknown>[] })[
      "@graph"
    ]
    expect(nodes.find((n) => n["@type"] === "FAQPage")).toMatchObject({
      mainEntity: [{ name: "Does it work?" }],
    })
    expect(nodes.find((n) => n["@type"] === "Service")).toMatchObject({
      name: "Single",
      offers: {
        "@type": "Offer",
        price: "90.00",
        url: "https://example.ie/services/anxiety",
      },
    })
  })
})
