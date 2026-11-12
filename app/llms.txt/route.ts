import { connection } from "next/server"

import { renderLlms } from "@/lib/seo/llms"
import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"
import { getLlmsEntries } from "@/server/modules/seo/queries"

// Request-time (connection) because the build has no database; the data is
// cached under the sitemap's tags.
export async function GET() {
  await connection()
  const origin = getEnv().SITE_URL.replace(/\/$/, "")
  const [site, seo, entries] = await Promise.all([
    getSetting("site"),
    getSetting("seo"),
    getLlmsEntries(),
  ])
  return new Response(
    renderLlms({
      name: site.name,
      description: seo.defaultDescription,
      origin,
      entries,
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  )
}
