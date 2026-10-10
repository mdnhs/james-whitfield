import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { localFile } from "./storage"

export type MediaFile = {
  driver: "static" | "local" | "s3"
  key: string
  url: string
}

const MAX_BYTES = 20 * 1024 * 1024
const STATIC_URL = /^\/[\w./-]+$/

// The original bytes of a media row, or null when they cannot be read.
// Static rows are seeded files under public/ (the only SVGs we hold).
export async function readMediaBytes(
  file: MediaFile,
  publicDir = path.join(process.cwd(), "public")
): Promise<Buffer | null> {
  try {
    if (file.driver === "static") {
      if (!STATIC_URL.test(file.url) || file.url.includes("..")) return null
      const full = path.join(publicDir, file.url)
      if (!full.startsWith(publicDir + path.sep)) return null
      return await readFile(full)
    }
    if (file.driver === "local") {
      const local = localFile(file.key)
      return local ? await readFile(local.path) : null
    }
    const response = await fetch(file.url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    })
    if (!response.ok || !response.body) return null
    const declared = Number(response.headers.get("content-length"))
    if (declared > MAX_BYTES) return null
    const chunks: Uint8Array[] = []
    let total = 0
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}
