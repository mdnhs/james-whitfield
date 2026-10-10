import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PublishedPage } from "@/lib/content/types"
import { getMedia, getPublishedPage } from "@/server/modules/content/queries"

import { cmsMetadata } from "./cms-page"

vi.mock("@/server/modules/content/preview", () => ({
  isPreviewing: vi.fn(async () => false),
}))
vi.mock("next/cache", () => ({ io: async () => {} }))
vi.mock("@/server/modules/content/queries", () => ({
  getMedia: vi.fn(),
  getPublishedPage: vi.fn(),
  getSetting: vi.fn(),
}))

const OG_ID = "00000000-0000-4000-8000-000000000009"
const page = (seo: Partial<PublishedPage["seo"]>): PublishedPage => ({
  id: "p",
  path: "/about",
  title: "About",
  systemKey: "about",
  document: { blocks: [] },
  seo: {
    title: null,
    description: null,
    ogImage: null,
    noindex: false,
    canonical: null,
    ogTitle: null,
    ogDescription: null,
    twitterCard: "summary_large_image",
    ...seo,
  },
  settings: { showContactChapter: true, needsReview: false },
})

describe("cmsMetadata", () => {
  beforeEach(() => vi.mocked(getMedia).mockResolvedValue(new Map()))

  it("keeps an indexable page free of robots and og tags", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(page({}))
    expect(await cmsMetadata("/about")).toEqual({
      title: "About",
      description: undefined,
    })
  })

  it("emits noindex and the share image from the page's SEO", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(
      page({ noindex: true, ogImage: { mediaId: OG_ID } })
    )
    vi.mocked(getMedia).mockResolvedValue(
      new Map([
        [
          OG_ID,
          {
            id: OG_ID,
            src: "/media/og.jpg",
            width: 1200,
            height: 630,
            blurDataURL: null,
            alt: "Clinic",
            focal: null,
          },
        ],
      ])
    )
    const meta = await cmsMetadata("/about")
    expect(meta.robots).toEqual({ index: false })
    expect(meta.openGraph?.images).toEqual([
      { url: "/media/og.jpg", width: 1200, height: 630, alt: "Clinic" },
    ])
  })

  it("drops a share image whose asset is gone", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(
      page({ ogImage: { mediaId: OG_ID } })
    )
    expect((await cmsMetadata("/about")).openGraph).toBeUndefined()
  })
})
