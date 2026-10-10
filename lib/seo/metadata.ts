import type { Metadata } from "next"

import type { PageSeo } from "@/blocks/page"
import type { GlobalValue } from "@/lib/content/globals"
import type { MediaAsset } from "@/lib/media"

import { iconHref } from "./icons"
import { documentTitle } from "./title"

export const OG_SIZE = { width: 1200, height: 630 } as const
const LOCALE = "en_IE"

export type SeoDefaults = {
  titleTemplate: string
  defaultTitle: string
  defaultDescription: string
  siteName: string
  professionalTitle: string
}

export type SeoSubject = {
  path: string
  home: boolean
  kind: "page" | "article"
  title: string
  // Fallback description (an article's excerpt).
  summary: string | null
  // The card's small line: the article category; null → professional title.
  eyebrow: string | null
  seo: PageSeo
  // The uploaded share image, resolved; null → the generated card.
  ogImage: MediaAsset | null
  article?: {
    publishedTime: string
    modifiedTime: string
    authors: string[]
    section: string
  }
  draft?: boolean
}

// A stored "" or whitespace counts as missing, so the fallbacks still apply.
export function blank(v: string | null | undefined) {
  return v?.trim() ? v : null
}

// FNV-1a: a short, stable cache-buster for the generated card's URL.
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

// Ruling R8: app/og/[[...path]] renders the card for a site path.
export function ogImageUrl(path: string, title: string, eyebrow: string) {
  return `/og${path === "/" ? "" : path}?v=${hash(`${title}\n${eyebrow}`)}`
}

// docs/brief.md §11 buildMetadata(entity, defaults, path).
export function buildMetadata(s: SeoSubject, d: SeoDefaults): Metadata {
  const title = documentTitle(
    { home: s.home, title: s.title, seoTitle: s.seo.title },
    d
  )
  const description =
    blank(s.seo.description) ?? blank(s.summary) ?? blank(d.defaultDescription)
  const canonical = blank(s.seo.canonical) ?? s.path
  const ogTitle = blank(s.seo.ogTitle) ?? title
  const ogDescription = blank(s.seo.ogDescription) ?? description
  const image = s.ogImage
    ? {
        url: s.ogImage.src,
        width: s.ogImage.width,
        height: s.ogImage.height,
        alt: s.ogImage.alt || ogTitle,
      }
    : {
        url: ogImageUrl(s.path, ogTitle, s.eyebrow ?? d.professionalTitle),
        ...OG_SIZE,
        alt: ogTitle,
      }
  const robots = s.draft
    ? { index: false, follow: false }
    : s.seo.noindex
      ? { index: false, follow: true }
      : undefined
  return {
    title: { absolute: title },
    description: description ?? undefined,
    alternates: { canonical },
    // A child's openGraph replaces the parent's whole object, so the
    // site-wide fields are repeated here.
    openGraph: {
      type: s.kind === "article" ? "article" : "website",
      url: canonical,
      siteName: d.siteName,
      locale: LOCALE,
      title: ogTitle,
      description: ogDescription ?? undefined,
      images: [image],
      ...(s.kind === "article" && s.article ? s.article : {}),
    },
    twitter: {
      card: s.seo.twitterCard,
      title: ogTitle,
      description: ogDescription ?? undefined,
      images: [image.url],
    },
    ...(robots ? { robots } : {}),
  }
}

export type RootMetadataInput = {
  siteUrl: string
  seo: GlobalValue<"seo">
  siteName: string
  iconVersion: string | null
  defaultOgImage: MediaAsset | null
}

// The site root generateMetadata (docs/brief.md §11).
export function rootMetadata(i: RootMetadataInput): Metadata {
  const { verification } = i.seo
  const hasVerification = Boolean(verification.google || verification.bing)
  return {
    metadataBase: new URL(i.siteUrl),
    title: {
      default: i.seo.defaultTitle || i.siteName,
      template: i.seo.titleTemplate || "%s",
    },
    description: i.seo.defaultDescription || undefined,
    applicationName: i.siteName || undefined,
    formatDetection: { email: false, address: false, telephone: false },
    ...(i.iconVersion
      ? {
          icons: {
            icon: [
              {
                url: iconHref(32, i.iconVersion),
                sizes: "32x32",
                type: "image/png",
              },
              {
                url: iconHref(192, i.iconVersion),
                sizes: "192x192",
                type: "image/png",
              },
            ],
            apple: [
              {
                url: iconHref(180, i.iconVersion),
                sizes: "180x180",
                type: "image/png",
              },
            ],
          },
        }
      : {}),
    ...(hasVerification
      ? {
          verification: {
            ...(verification.google ? { google: verification.google } : {}),
            ...(verification.bing
              ? { other: { "msvalidate.01": verification.bing } }
              : {}),
          },
        }
      : {}),
    openGraph: {
      type: "website",
      siteName: i.siteName,
      locale: LOCALE,
      ...(i.defaultOgImage
        ? {
            images: [
              {
                url: i.defaultOgImage.src,
                width: i.defaultOgImage.width,
                height: i.defaultOgImage.height,
                alt: i.defaultOgImage.alt,
              },
            ],
          }
        : {}),
    },
    twitter: { card: "summary_large_image" },
    ...(i.seo.robots === "noindex"
      ? { robots: { index: false, follow: false } }
      : {}),
  }
}
