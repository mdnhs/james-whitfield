import "server-only"

// docs/brief.md §14: the allowlist is checked against the bytes, never the
// filename or the browser's Content-Type. SVG and Lottie JSON are text, so
// they are recognised by their opening markup; process.ts then checks the
// whole file (SVG for script, Lottie for its shape).
export type Sniffed =
  | { mime: "image/jpeg"; ext: "jpg" }
  | { mime: "image/png"; ext: "png" }
  | { mime: "image/webp"; ext: "webp" }
  | { mime: "image/avif"; ext: "avif" }
  | { mime: "image/svg+xml"; ext: "svg" }
  | { mime: "image/x-icon"; ext: "ico" }
  | { mime: "application/pdf"; ext: "pdf" }
  | { mime: "application/json"; ext: "json" }

// Leading text before the root element: a BOM, whitespace, an XML
// declaration, comments and a DOCTYPE (Illustrator writes one). One with
// an internal subset (entities) is refused later, in formats.ts.
const SVG_PROLOGUE =
  /^\uFEFF?\s*(?:<\?xml[^>]*\?>\s*)?(?:(?:<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)\s*)*/

export function sniff(bytes: Uint8Array): Sniffed | null {
  const at = (offset: number, signature: readonly number[]) =>
    signature.every((byte, i) => bytes[offset + i] === byte)
  const ascii = (offset: number, text: string) =>
    at(
      offset,
      [...text].map((ch) => ch.charCodeAt(0))
    )
  if (at(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" }
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", ext: "png" }
  if (ascii(0, "RIFF") && ascii(8, "WEBP"))
    return { mime: "image/webp", ext: "webp" }
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis")))
    return { mime: "image/avif", ext: "avif" }
  if (ascii(0, "%PDF-")) return { mime: "application/pdf", ext: "pdf" }
  // ICONDIR: reserved 0, type 1 (icon), at least one image.
  if (at(0, [0, 0, 1, 0]) && bytes.length > 6 && (bytes[4]! || bytes[5]!))
    return { mime: "image/x-icon", ext: "ico" }
  const head = new TextDecoder().decode(bytes.subarray(0, 4096))
  const rest = head.replace(SVG_PROLOGUE, "")
  if (/^<svg[\s>/]/.test(rest)) return { mime: "image/svg+xml", ext: "svg" }
  if (/^\uFEFF?\s*\{/.test(head))
    return { mime: "application/json", ext: "json" }
  return null
}
