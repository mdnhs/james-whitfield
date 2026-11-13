// lib/media.ts
// What a section needs to draw an image. Built from a `media` row by the
// content repo; blocks store only { mediaId } (blocks/media-refs.ts).
export type MediaAsset = {
  id: string | null
  src: string
  width: number
  height: number
  blurDataURL: string | null
  alt: string
  focal: { x: number; y: number } | null
}

// SVG and ICO are served as uploaded: next/image cannot resize them.
export const servedAsIs = (src: string) => /\.(?:svg|ico)(?:[?#]|$)/i.test(src)
