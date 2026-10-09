import { readFile } from "node:fs/promises"

import { localFile } from "@/server/lib/media/storage"

const NOT_FOUND = () =>
  new Response("Not found", {
    status: 404,
    headers: { "X-Content-Type-Options": "nosniff" },
  })

// Serves the `local` driver (docs/brief.md §14). Only keys matching
// MEDIA_KEY resolve (no traversal, no listing: a directory never matches),
// and the type comes from the key's extension, set at upload from the
// sniffed bytes. Keys are content-hashed, so responses are immutable. The
// CSP sandbox keeps a crafted PDF inert.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/uploads/[...key]">
) {
  const { key } = await ctx.params
  const file = localFile(key.join("/"))
  if (!file) return NOT_FOUND()
  try {
    return new Response(new Uint8Array(await readFile(file.path)), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    })
  } catch {
    return NOT_FOUND()
  }
}
