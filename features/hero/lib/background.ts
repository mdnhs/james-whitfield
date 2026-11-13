import type { MediaAsset } from "@/lib/media"

// The hero.home `background` group after media resolution. Rows saved before
// the field existed have none at all.
export type HeroBackgroundValue =
  { image: MediaAsset | null; depth: MediaAsset | null } | null | undefined

export type HeroBackgroundPlan =
  | { kind: "default" }
  | {
      kind: "custom"
      image: MediaAsset
      depth: MediaAsset | null
      // Where the photo sits in its cover box, in shader space (y up):
      // matches CSS object-position from the asset's focal point.
      align: { x: number; y: number }
    }

// Unset keeps the bundled photo and its full scene; a custom photo replaces
// it. A depth map on its own is ignored.
export function heroBackgroundPlan(
  background: HeroBackgroundValue
): HeroBackgroundPlan {
  const image = background?.image
  if (!image) return { kind: "default" }
  const focal = image.focal ?? { x: 0.5, y: 0.5 }
  return {
    kind: "custom",
    image,
    depth: background?.depth ?? null,
    align: { x: focal.x, y: 1 - focal.y },
  }
}

// The plane that stays still while the camera moves: the median depth of the
// centre region (the middle 40% each way), where the subject usually is.
// Values are 0..255 (near = bright, as in hero-depth.png); returns 0..1.
export function focusFromDepth(
  data: ArrayLike<number>,
  width: number,
  height: number,
  { stride = 4, region = 0.4 }: { stride?: number; region?: number } = {}
): number {
  const x0 = Math.floor(width * (0.5 - region / 2))
  const x1 = Math.ceil(width * (0.5 + region / 2))
  const y0 = Math.floor(height * (0.5 - region / 2))
  const y1 = Math.ceil(height * (0.5 + region / 2))
  // Counting sort: 8-bit values, so the median needs no full sort.
  const counts = new Uint32Array(256)
  let total = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = data[(y * width + x) * stride]
      if (v === undefined) continue
      counts[Math.min(255, Math.max(0, Math.round(v)))]!++
      total++
    }
  }
  if (!total) return 0.5
  const middle = (total - 1) / 2
  let seen = 0
  let lower = -1
  for (let v = 0; v < 256; v++) {
    const next = seen + counts[v]!
    if (lower < 0 && next > Math.floor(middle)) lower = v
    if (next > Math.ceil(middle)) return (lower + v) / 2 / 255
    seen = next
  }
  return 0.5
}

// No depth map yet (or it failed): every pixel sits slightly in front of the
// focus plane, so the camera's sway, breath and scroll zoom move the whole
// photo as one gentle layer instead of nothing at all.
export const FLAT_DEPTH = { depth: 0.5, focus: 0.45 } as const

// The longest edge a generated depth map keeps: parallax needs no more.
export const DEPTH_MAX_EDGE = 1024

export function fitSize(
  width: number,
  height: number,
  max = DEPTH_MAX_EDGE
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

// Model output (relative inverse depth: larger = nearer, any range, one or
// more channels) → grayscale RGBA stretched to 0..255, near = bright, the
// convention of hero-depth.png and the shader (rel = depth - focus).
export function depthToRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
  channels = 1
): Uint8ClampedArray {
  const count = width * height
  const out = new Uint8ClampedArray(count * 4)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < count; i++) {
    const v = data[i * channels]!
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min
  for (let i = 0; i < count; i++) {
    const v = range > 0 ? ((data[i * channels]! - min) / range) * 255 : 128
    const o = i * 4
    out[o] = out[o + 1] = out[o + 2] = Math.round(v)
    out[o + 3] = 255
  }
  return out
}
