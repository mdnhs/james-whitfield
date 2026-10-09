import "server-only"

import { createHash } from "node:crypto"

import sharp from "sharp"

import { slugify } from "@/lib/utils"
import { ApiError } from "@/server/api/errors"

import { probeImage } from "./probe"
import { sniff, type Sniffed } from "./sniff"

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const MAX_EDGE = 4000
// Decompression-bomb guard: a small file can declare a huge canvas. 50 MP
// covers phone and most camera photos (a 50 MP decode is ~150 MB); sharp
// refuses anything larger before decoding the pixels.
const MAX_INPUT_PIXELS = 50_000_000

// At most two images decode at once per process, with a short queue behind
// them; past that the upload is refused (503) rather than queued without
// bound, so a burst of uploads cannot exhaust memory.
const MAX_RUNNING = 2
const MAX_WAITING = 8
let running = 0
const waiting: (() => void)[] = []

export async function withProcessingSlot<T>(
  work: () => Promise<T>
): Promise<T> {
  if (running >= MAX_RUNNING) {
    if (waiting.length >= MAX_WAITING) {
      throw new ApiError(
        "UNAVAILABLE",
        "The server is busy processing uploads. Try again in a moment."
      )
    }
    await new Promise<void>((resolve) => waiting.push(resolve))
  } else {
    running++
  }
  try {
    return await work()
  } finally {
    // Hand the slot straight to the next waiter, or free it.
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

// What sharp reports for each allowed type. A file whose magic bytes and
// decoded format disagree is refused (docs/brief.md §14).
const SHARP_FORMAT = {
  jpg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "heif",
} as const

export type ProcessedUpload = {
  body: Buffer
  key: string
  mimeType: Sniffed["mime"]
  sizeBytes: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
  dominantColor: string | null
}

const unreadable = () =>
  new ApiError("VALIDATION_FAILED", "That image could not be read", {
    file: ["That image could not be read"],
  })

// autoOrient bakes the EXIF rotation into the pixels; sharp writes no
// metadata unless asked, so EXIF (GPS included), XMP and IPTC go here. The
// re-encode also drops anything appended to or hidden in the original bytes.
async function normalise(input: Buffer, type: Sniffed) {
  const options = {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
  } as const
  if (type.ext === "pdf") throw new Error("normalise: pdf is not an image")
  const { format } = await sharp(input, options).metadata()
  if (format !== SHARP_FORMAT[type.ext]) throw unreadable()
  const image = sharp(input, options).autoOrient().resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  })
  switch (type.ext) {
    case "jpg":
      return image.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    case "png":
      return image.png({ compressionLevel: 9 }).toBuffer()
    case "webp":
      return image.webp({ quality: 88 }).toBuffer()
    case "avif":
      return image.avif({ quality: 60 }).toBuffer()
  }
}

// The client's filename is only a label: keep the last path segment and drop
// control characters, so it never reads as a path anywhere it is shown.
export function cleanFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ""
  return (
    base
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 200) || "file"
  )
}

export async function processUpload(
  input: Buffer,
  filename: string,
  now = new Date()
): Promise<ProcessedUpload> {
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Files can be up to 20 MB")
  }
  const type = sniff(input)
  if (!type) {
    throw new ApiError(
      "VALIDATION_FAILED",
      "Upload a JPEG, PNG, WebP, AVIF or PDF",
      {
        file: ["Upload a JPEG, PNG, WebP, AVIF or PDF"],
      }
    )
  }
  let body = input
  let probe = {
    width: null as number | null,
    height: null as number | null,
    blurDataUrl: null as string | null,
    dominantColor: null as string | null,
  }
  if (type.ext !== "pdf") {
    try {
      ;({ body, probe } = await withProcessingSlot(async () => {
        const normalised = await normalise(input, type)
        return { body: normalised, probe: await probeImage(normalised) }
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw unreadable()
    }
  }
  // Content-hashed and immutable (docs/brief.md §14): a replace gets a new key.
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16)
  const slug =
    slugify(cleanFilename(filename).replace(/\.[^.]*$/, ""))
      .slice(0, 60)
      .replace(/-$/, "") || "file"
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return {
    body,
    key: `media/${now.getUTCFullYear()}/${month}/${hash}-${slug}.${type.ext}`,
    mimeType: type.mime,
    sizeBytes: body.length,
    ...probe,
  }
}
