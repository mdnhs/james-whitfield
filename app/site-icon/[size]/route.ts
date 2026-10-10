import { connection } from "next/server"

import { ICON_SIZES } from "@/lib/seo/icons"
import { brandIcon } from "@/server/modules/theme/icons"

// Ruling R13: /site-icon/32 · 180 · 192 · 512. Anything else is 404.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/site-icon/[size]">
) {
  await connection()
  const size = Number((await ctx.params).size)
  if (!(ICON_SIZES as readonly number[]).includes(size))
    return new Response("Not found", { status: 404 })
  const png = await brandIcon(size)
  if (!png) return new Response("Not found", { status: 404 })
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
