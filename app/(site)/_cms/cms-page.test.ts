import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PublishedPage } from "@/lib/content/types"
import {
  getMedia,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"
import { isPreviewing } from "@/server/modules/content/preview"

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

const asset = {
  id: OG_ID,
  src: "/media/og.jpg",
  width: 1200,
  height: 630,
  blurDataURL: null,
  alt: "Clinic",
  focal: null,
}

describe("cmsMetadata", () => {
  beforeEach(() => {
    vi.mocked(getMedia).mockResolvedValue(new Map())
    vi.mocked(getSetting).mockImplementation((async (key: string) =>
      key === "seo"
        ? {
            titleTemplate: "%s | Magda",
            defaultTitle: "Magda",
            defaultDescription: "Default",
          }
        : { name: "Magda", professionalTitle: "Therapist" }) as never)
  })

  it("builds full metadata with the generated card by default", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(page({}))
    const meta = await cmsMetadata("/about")
    expect(meta.title).toEqual({ absolute: "About | Magda" })
    expect(meta.robots).toBeUndefined()
    expect(meta.alternates?.canonical).toBe("/about")
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({
        url: expect.stringMatching(/^\/og\/about\?v=/),
      }),
    ])
  })

  it("emits noindex and the share image from the page's SEO", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(
      page({ noindex: true, ogImage: { mediaId: OG_ID } })
    )
    vi.mocked(getMedia).mockResolvedValue(new Map([[OG_ID, asset]]))
    const meta = await cmsMetadata("/about")
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.openGraph?.images).toEqual([
      { url: "/media/og.jpg", width: 1200, height: 630, alt: "Clinic" },
    ])
  })

  it("falls back to the generated card when the share image is gone", async () => {
    vi.mocked(getPublishedPage).mockResolvedValue(
      page({ ogImage: { mediaId: OG_ID } })
    )
    expect(meta(await cmsMetadata("/about"))).toMatch(/^\/og\/about\?v=/)
  })

  it("marks a draft preview noindex,nofollow", async () => {
    vi.mocked(isPreviewing).mockResolvedValueOnce(true)
    vi.mocked(getPublishedPage).mockResolvedValue(page({}))
    expect((await cmsMetadata("/about")).robots).toEqual({
      index: false,
      follow: false,
    })
  })
})

const meta = (m: Awaited<ReturnType<typeof cmsMetadata>>) =>
  (m.openGraph?.images as { url: string }[])[0]!.url
