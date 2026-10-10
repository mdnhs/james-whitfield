import { connection } from "next/server"

import { ogColors } from "@/lib/seo/og-theme"
import { getSetting } from "@/server/modules/content/queries"
import { ogSubjectFor, renderOg } from "@/server/modules/seo/og"

// Ruling R8: the generated share card for a site path.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/og/[[...path]]">
) {
  await connection()
  const { path = [] } = await ctx.params
  const subject = await ogSubjectFor(`/${path.join("/")}`)
  if (!subject) return new Response("Not found", { status: 404 })
  const image = await renderOg(
    subject,
    ogColors((await getSetting("theme")).site)
  )
  image.headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800"
  )
  return image
}
