import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { blank, OG_SIZE } from "@/lib/seo/metadata"
import {
  getArticle,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"

export type OgSubject = { title: string; eyebrow: string; siteName: string }
type Colors = { background: string; text: string; accent: string }

// Read once per process; traced into the standalone build (Ruling R9).
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Fraunces-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
])

// Flexbox only (ImageResponse/Satori). Ruling R8: the logo is a wordmark.
export function OgCard({
  title,
  eyebrow,
  siteName,
  colors,
}: OgSubject & { colors: Colors }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: colors.background,
        color: colors.text,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: colors.accent,
          letterSpacing: 1,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Fraunces",
          fontSize: title.length > 60 ? 64 : 80,
          lineHeight: 1.08,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 30,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: colors.accent,
          }}
        />
        {siteName}
      </div>
    </div>
  )
}

export async function renderOg(subject: OgSubject, colors: Colors) {
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
