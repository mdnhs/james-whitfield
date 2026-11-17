import { connection } from "next/server"

import { renderLlms } from "@/lib/seo/llms"
import { getSiteOrigin } from "@/server/modules/seo/site-origin"
import { getSetting } from "@/server/modules/content/queries"
import { getLlmsEntries } from "@/server/modules/seo/queries"

// Request-time (connection) because the build has no database; the data is
// cached under the sitemap's tags.
export async function GET() {
  await connection()
  const origin = await getSiteOrigin()
  const [site, seo, entries] = await Promise.all([
    getSetting("site"),
    getSetting("seo"),
    getLlmsEntries(),
  ])
  // Switched off, or the whole site is hidden from search: no file.
  if (!seo.llms.enabled || seo.robots === "noindex")
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  return new Response(
    renderLlms({
      name: site.name,
      description: seo.llms.summary.trim() || seo.defaultDescription,
      origin,
      entries,
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  )
}
