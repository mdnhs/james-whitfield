import "server-only"

import sharp from "sharp"

// ---------------------------------------------------------------- SVG ----

// An uploaded SVG is served as an image, where script never runs. Opened on
// its own it is a document, so anything that could run or load script is
// refused rather than stripped: a stripped file may not be what was meant.
const SVG_FORBIDDEN: [RegExp, string][] = [
  [/<script[\s>/]/i, "script"],
  [/<foreignObject[\s>/]/i, "foreignObject"],
  [
    /<(?:iframe|embed|object|audio|video|handler|listener)[\s>/]/i,
    "embedded content",
  ],
  [/<!ENTITY|<!DOCTYPE[^>]*\[/i, "entity declarations"],
  [/<\?xml-stylesheet/i, "an external stylesheet"],
  [/[\s"'/]on[a-z]+\s*=/i, "an event handler"],
  [/(?:java|vb)script\s*:/i, "a script link"],
  [/data\s*:\s*(?:text|application)\//i, "an embedded document"],
  [/attributeName\s*=\s*["']?\s*(?:xlink:)?href/i, "an animated link"],
  // Entity-encoded characters can hide a scheme from the checks above.
  [/\b(?:xlink:)?href\s*=\s*["']?\s*&#/i, "an encoded link"],
]

export function svgProblem(text: string): string | null {
  for (const [pattern, what] of SVG_FORBIDDEN) {
    if (pattern.test(text)) return `SVG files can't contain ${what}`
  }
  return null
}

// --------------------------------------------------------------- ICO ----

type IcoEntry = { width: number; height: number; data: Buffer }

// The ICONDIR entries whose bytes lie inside the file.
function icoEntries(buf: Buffer): IcoEntry[] {
  if (buf.length < 6) return []
  const count = buf.readUInt16LE(4)
  const entries: IcoEntry[] = []
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16
    if (at + 16 > buf.length) break
    const size = buf.readUInt32LE(at + 8)
    const offset = buf.readUInt32LE(at + 12)
    if (size === 0 || offset + size > buf.length) continue
    entries.push({
      width: buf[at]! || 256,
      height: buf[at + 1]! || 256,
      data: buf.subarray(offset, offset + size),
    })
  }
  return entries
}

const PNG = [0x89, 0x50, 0x4e, 0x47]

// A 32-bit BMP entry (bottom-up BGRA, AND mask ignored) as raw RGBA.
function bmpToRgba(data: Buffer) {
  if (data.length < 40 || data.readUInt32LE(0) < 40) return null
  const width = data.readInt32LE(4)
  const height = Math.abs(data.readInt32LE(8)) / 2
  const bits = data.readUInt16LE(14)
  if (bits !== 32 || width <= 0 || height <= 0 || width > 1024) return null
  const start = data.readUInt32LE(0)
  const stride = width * 4
  if (start + stride * height > data.length) return null
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const row = start + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const s = row + x * 4
      const d = y * stride + x * 4
      out[d] = data[s + 2]!
      out[d + 1] = data[s + 1]!
      out[d + 2] = data[s]!
      out[d + 3] = data[s + 3]!
    }
  }
  return { out, width, height }
}

// The largest image in an .ico, as PNG (sharp cannot read .ico itself).
// Null when it holds only palette BMPs, which are rare in modern icons.
export async function icoToPng(buf: Buffer): Promise<Buffer | null> {
  const entries = icoEntries(buf).sort(
    (a, b) => b.width * b.height - a.width * a.height
  )
  for (const entry of entries) {
    if (PNG.every((byte, i) => entry.data[i] === byte)) {
      const { format } = await sharp(entry.data).metadata()
      if (format === "png") return entry.data
      continue
    }
    const bmp = bmpToRgba(entry.data)
    if (bmp) {
      return sharp(bmp.out, {
        raw: { width: bmp.width, height: bmp.height, channels: 4 },
      })
        .png()
        .toBuffer()
    }
  }
  return null
}

export function icoSize(buf: Buffer) {
  const [largest] = icoEntries(buf).sort(
    (a, b) => b.width * b.height - a.width * a.height
  )
  return largest ? { width: largest.width, height: largest.height } : null
}

// ------------------------------------------------------------ Lottie ----

// The fields every Lottie (bodymovin) animation carries.
export function lottieSize(
  text: string
): { width: number; height: number } | null {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return null
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null
  const d = doc as Record<string, unknown>
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v)
  if (
    typeof d.v !== "string" ||
    !num(d.fr) ||
    !num(d.ip) ||
    !num(d.op) ||
    !num(d.w) ||
    !num(d.h) ||
    !Array.isArray(d.layers)
  )
    return null
  return {
    width: Math.round(d.w as number),
    height: Math.round(d.h as number),
  }
}
