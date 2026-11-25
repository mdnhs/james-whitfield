import { readFile } from "node:fs/promises"
import path from "node:path"

import { connection } from "next/server"

import { brandIcon } from "@/server/modules/theme/icons"

// /favicon.ico serves the icon uploaded in the admin (Identity), as a PNG
// (browsers sniff the content, whatever the extension). Falls back to the
// bundled default while no icon is set.
export async function GET() {
  await connection()
  const headers = {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "X-Content-Type-Options": "nosniff",
  }
  const png = await brandIcon(48)
  if (png)
    return new Response(png, {
      headers: { ...headers, "Content-Type": "image/png" },
    })
  const fallback = await readFile(
    path.join(process.cwd(), "public", "default-favicon.ico")
  )
  return new Response(new Uint8Array(fallback), {
    headers: { ...headers, "Content-Type": "image/x-icon" },
  })
}
