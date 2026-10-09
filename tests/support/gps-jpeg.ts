import { randomFillSync } from "node:crypto"

import sharp from "sharp"

// A camera-like JPEG: GPS EXIF and noise, so it stays large after encoding.
export async function gpsJpeg(targetBytes = 15 * 1024 * 1024) {
  const width = 4000
  const height = 3000
  const noise = randomFillSync(Buffer.alloc(width * height * 3))
  for (const quality of [85, 90, 93, 96, 100]) {
    const out = await sharp(noise, { raw: { width, height, channels: 3 } })
      .withExif({
        IFD0: { Make: "Test", Model: "Camera" },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "53/1 20/1 0/1",
          GPSLongitudeRef: "W",
          GPSLongitude: "6/1 15/1 0/1",
        },
      })
      .jpeg({ quality })
      .toBuffer()
    if (out.length >= targetBytes) return out
  }
  throw new Error("gpsJpeg: could not reach the target size")
}
