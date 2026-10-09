import "server-only"

import sharp from "sharp"

export type ImageProbe = {
  width: number
  height: number
  blurDataUrl: string | null
  dominantColor: string | null
}

// Size, a 16 px WebP blur placeholder and the dominant colour (docs/brief.md
// §14). Vector images are measured only.
export async function probeImage(
  input: Buffer,
  { raster = true }: { raster?: boolean } = {}
): Promise<ImageProbe> {
  const { width = 0, height = 0 } = await sharp(input).metadata()
  if (!raster) return { width, height, blurDataUrl: null, dominantColor: null }
  const [blur, stats] = await Promise.all([
    sharp(input)
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 50 })
      .toBuffer(),
    sharp(input).stats(),
  ])
  const hex = [stats.dominant.r, stats.dominant.g, stats.dominant.b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
  return {
    width,
    height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominantColor: `#${hex}`,
  }
}
