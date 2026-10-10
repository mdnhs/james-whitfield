import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { toHex } from "@/lib/theme/color"
import { resolveSiteTokens } from "@/lib/theme/site"
import {
  getMedia,
  getSetting,
  getThemeConfig,
} from "@/server/modules/content/queries"

const iconType = (src: string) => {
  const ext = /\.([a-z0-9]+)(?:\?|$)/i.exec(src)?.[1]?.toLowerCase()
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "webp") return "image/webp"
  if (ext === "svg") return "image/svg+xml"
  return "image/png"
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection()
  const [site, theme] = await Promise.all([
    getSetting("site"),
    getThemeConfig(),
  ])
  const icon = site.icon
    ? (await getMedia([site.icon.mediaId])).get(site.icon.mediaId)
    : undefined
  const tokens = resolveSiteTokens(theme.site)
  return {
    name: site.name,
    short_name: site.name.split(" ")[0] || site.name,
    start_url: "/",
    display: "browser",
    lang: "en-IE",
    background_color: toHex(tokens.cream),
    theme_color: toHex(tokens.brand),
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      ...(icon
        ? [
            {
              src: icon.src,
              sizes: `${icon.width}x${icon.height}`,
              type: iconType(icon.src),
            },
          ]
        : []),
    ],
  }
}
