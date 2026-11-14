import { connection } from "next/server"

import { brandLottie } from "@/server/modules/theme/icons"

// The animated logo's JSON for the site's Lottie player (Appearance ▸ Brand
// images). The page links it with ?v=<file hash>, so a new file is a new URL.
export async function GET() {
  await connection()
  const json = await brandLottie()
  if (!json) return new Response("Not found", { status: 404 })
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
