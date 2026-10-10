import { describe, expect, it } from "vitest"

import { PageSeo } from "@/blocks/page"
import type { MediaAsset } from "@/lib/media"

import { buildMetadata, ogImageUrl, rootMetadata } from "./metadata"

const defaults = {
  titleTemplate: "%s | Magda Kennedy",
  defaultTitle: "Magda Kennedy: Hypnotherapist",
  defaultDescription: "Clinical hypnotherapy in Dublin and online.",
  siteName: "Magda Kennedy",
  professionalTitle: "Clinical Hypnotherapist",
}
const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "m1",
  src: "/uploads/share.jpg",
  width: 1200,
  height: 630,
  blurDataURL: null,
  alt: "Share",
  focal: null,
  ...over,
})
const page = (seo: Partial<PageSeo> = {}) => ({
  path: "/about",
  home: false,
  kind: "page" as const,
  title: "About",
  summary: null,
  eyebrow: null,
  seo: PageSeo.parse(seo),
  ogImage: null,
})

describe("buildMetadata", () => {
  it("sets the absolute title, canonical and site-wide OG fields", () => {
    const m = buildMetadata(page(), defaults)
    expect(m.title).toEqual({ absolute: "About | Magda Kennedy" })
    expect(m.description).toBe("Clinical hypnotherapy in Dublin and online.")
    expect(m.alternates).toEqual({ canonical: "/about" })
    expect(m.openGraph).toMatchObject({
      type: "website",
      url: "/about",
      siteName: "Magda Kennedy",
      locale: "en_IE",
      title: "About | Magda Kennedy",
    })
    expect(m.robots).toBeUndefined()
  })

  it("points og:image at the generated card when there is no upload", () => {
    const m = buildMetadata(page(), defaults)
    const [image] = (m.openGraph as { images: { url: string }[] }).images
    expect(image).toMatchObject({ width: 1200, height: 630 })
    expect(image!.url).toBe(
      ogImageUrl("/about", "About | Magda Kennedy", "Clinical Hypnotherapist")
    )
    expect(image!.url).toMatch(/^\/og\/about\?v=[0-9a-f]{8}$/)
    expect(ogImageUrl("/", "x", "y")).toMatch(/^\/og\?v=/)
  })

  it("lets an uploaded image, OG text, canonical and card type win", () => {
    const m = buildMetadata(
      {
        ...page({
          ogTitle: "Meet Magda",
          ogDescription: "Who I am.",
          canonical: "https://example.org/about",
          twitterCard: "summary",
          description: "About the practice.",
        }),
        ogImage: asset(),
      },
      defaults
    )
    expect(m.description).toBe("About the practice.")
    expect(m.alternates).toEqual({ canonical: "https://example.org/about" })
    expect(m.openGraph).toMatchObject({
      title: "Meet Magda",
      description: "Who I am.",
      images: [
        { url: "/uploads/share.jpg", width: 1200, height: 630, alt: "Share" },
      ],
    })
    expect(m.twitter).toMatchObject({ card: "summary", title: "Meet Magda" })
  })

  it("marks noindex entities and draft previews", () => {
    expect(buildMetadata(page({ noindex: true }), defaults).robots).toEqual({
      index: false,
      follow: true,
    })
    expect(buildMetadata({ ...page(), draft: true }, defaults).robots).toEqual({
      index: false,
      follow: false,
    })
  })

  it("describes articles", () => {
    const m = buildMetadata(
      {
        ...page(),
        path: "/insights/calm",
        kind: "article",
        title: "Calm is a skill",
        summary: "An excerpt.",
        eyebrow: "Anxiety",
        article: {
          publishedTime: "2026-01-02T00:00:00.000Z",
          modifiedTime: "2026-01-03T00:00:00.000Z",
          authors: ["Magda Kennedy"],
          section: "Anxiety",
        },
      },
      defaults
    )
    expect(m.description).toBe("An excerpt.")
    expect(m.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-01-02T00:00:00.000Z",
      modifiedTime: "2026-01-03T00:00:00.000Z",
      authors: ["Magda Kennedy"],
      section: "Anxiety",
    })
  })
})

describe("rootMetadata", () => {
  const seo = {
    titleTemplate: "%s | Magda Kennedy",
    defaultTitle: "Magda Kennedy",
    defaultDescription: "Hypnotherapy.",
    defaultOgImage: null,
    robots: "index" as const,
    verification: { google: "g-code", bing: "b-code" },
    business: {
      type: "ProfessionalService" as const,
      priceRange: "€€",
      sameAs: [],
    },
  }
  it("sets base, template, verification, icons and format detection", () => {
    const m = rootMetadata({
      siteUrl: "https://magdakennedy.ie",
      seo,
      siteName: "Magda Kennedy",
      icon: asset({ src: "/uploads/icon.png" }),
      defaultOgImage: null,
    })
    expect(m.metadataBase?.toString()).toBe("https://magdakennedy.ie/")
    expect(m.title).toEqual({
      default: "Magda Kennedy",
      template: "%s | Magda Kennedy",
    })
    expect(m.verification).toEqual({
      google: "g-code",
      other: { "msvalidate.01": "b-code" },
    })
    expect(m.icons).toEqual({
      icon: "/uploads/icon.png",
      apple: "/uploads/icon.png",
    })
    expect(m.formatDetection).toEqual({
      email: false,
      address: false,
      telephone: false,
    })
    expect(m.robots).toBeUndefined()
  })
  it("turns the whole site noindex when the policy says so", () => {
    const m = rootMetadata({
      siteUrl: "https://x.ie",
      seo: {
        ...seo,
        robots: "noindex",
        verification: { google: "", bing: "" },
      },
      siteName: "X",
      icon: null,
      defaultOgImage: null,
    })
    expect(m.robots).toEqual({ index: false, follow: false })
    expect(m.verification).toBeUndefined()
  })
})
