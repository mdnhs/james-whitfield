import { readFile } from "node:fs/promises"

import { contentDisposition, localFile } from "@/server/lib/media/storage"

const NOT_FOUND = () =>
  new Response("Not found", {
    status: 404,
    headers: { "X-Content-Type-Options": "nosniff" },
  })

// Serves the `local` driver (docs/brief.md §14). Only keys matching
// MEDIA_KEY resolve (no traversal, no listing: a directory never matches),
// and the type comes from the key's extension, set at upload from the
// sniffed bytes. Keys are content-hashed, so responses are immutable. The
// CSP sandbox keeps a crafted file inert, and PDFs download
// (contentDisposition) instead of opening in a sandboxed viewer.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/uploads/[...key]">
) {
  const { key } = await ctx.params
  const name = key.join("/")
  const file = localFile(name)
  if (!file) return NOT_FOUND()
  try {
    return new Response(new Uint8Array(await readFile(file.path)), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
        ...(file.mimeType === "application/pdf" && {
          "Content-Disposition": contentDisposition(name)!,
        }),
      },
    })
  } catch {
    return NOT_FOUND()
  }
}
