import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { iconHref, iconVersion } from "@/lib/seo/icons"
import { toHex } from "@/lib/theme/color"
import { resolveSiteTokens } from "@/lib/theme/site"
import {
  getMedia,
  getSetting,
  getThemeConfig,
} from "@/server/modules/content/queries"

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
        ? [192, 512].map((size) => ({
            src: iconHref(size, iconVersion(icon.src)),
            sizes: `${size}x${size}`,
            type: "image/png",
          }))
        : []),
    ],
  }
}
