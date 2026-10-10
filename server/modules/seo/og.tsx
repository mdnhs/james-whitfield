import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { blank, OG_SIZE } from "@/lib/seo/metadata"
import { OgCard, type OgColors, type OgSubject } from "@/lib/seo/og-card"
import {
  getArticle,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"

export { OgCard, type OgColors, type OgSubject }

// Read once per process; traced into the standalone build (Ruling R9).
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Fraunces-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
])

export async function renderOg(subject: OgSubject, colors: OgColors) {
  const [fraunces, inter] = await fonts
  return new ImageResponse(<OgCard {...subject} colors={colors} />, {
    ...OG_SIZE,
    fonts: [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Inter", data: inter, weight: 400, style: "normal" },
    ],
  })
}

// "/" · "/about" · "/insights/<slug>" → what the card says; null → 404.
// Only published entities resolve (drafts are never requested here).
export async function ogSubjectFor(path: string): Promise<OgSubject | null> {
  const site = await getSetting("site")
  const article = /^\/insights\/([^/]+)$/.exec(path)
  if (article) {
    const found = await getArticle(article[1]!)
    if (!found) return null
    return {
      title: blank(found.seo.ogTitle) ?? found.title,
      eyebrow: found.category.name,
      siteName: site.name,
    }
  }
  const page = await getPublishedPage(path)
  if (!page) return null
  const seo = await getSetting("seo")
  const title =
    blank(page.seo.ogTitle) ??
    (page.systemKey === "home"
      ? page.seo.title || seo.defaultTitle || site.name
      : page.seo.title || page.title)
  return { title, eyebrow: site.professionalTitle, siteName: site.name }
}
